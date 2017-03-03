'use strict';

const Hapi = require('hapi');
const assert = require('chai').assert;
const mockery = require('mockery');
const sinon = require('sinon');

sinon.assert.expose(assert, { prefix: '' });

/**
 * helper to generate a nodemailer mock
 * @method getUserMock
 * @return {Function}         Stubbed function
 */
function getNodemailerMock() {
    const sendMailMock = {
        sendMail: sinon.stub().yieldsAsync()
    };

    return { createTransport: sinon.stub().returns(sendMailMock) };
}

describe('index', () => {
    let serverMock;
    let configMock;
    let notifier;
    let buildDataMock;
    let nodemailerMock;
    let EmailNotifier;

    before(() => {
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });

        nodemailerMock = getNodemailerMock();
        mockery.registerMock('nodemailer', nodemailerMock);

        // eslint-disable-next-line global-require
        EmailNotifier = require('../index');
    });

    after(() => {
        mockery.disable();
    });

    describe('notifier listens to server emits', () => {
        beforeEach(() => {
            nodemailerMock.createTransport.reset();

            serverMock = new Hapi.Server();
            configMock = {
                host: 'testing.aserver.com',
                port: 25,
                from: 'user@email.com'
            };
            buildDataMock = {
                settings: {
                    email: {
                        addresses: ['notify.me@email.com', 'notify.you@email.com'],
                        statuses: ['SUCCESS', 'FAILURE']
                    }
                },
                status: 'SUCCESS',
                pipelineName: 'screwdriver-cd/notifications',
                jobName: 'publish',
                buildId: '1234',
                buildLink: 'http://thisisaSDtest.com/builds/1234'
            };
            notifier = new EmailNotifier(configMock, serverMock, 'build_status_test');
        });

        it('verifies that included status creates nodemailer transporter', () => {
            serverMock.event('build_status_test');

            const saveMe = notifier.notify().then(() => {
                assert.calledWith(nodemailerMock.createTransport,
                    { host: configMock.host, port: configMock.port });
            });

            serverMock.emit('build_status_test', buildDataMock);

            return saveMe;
        });

        it('verifies that non-included status returns null', () => {
            const buildDataMockUnincluded = {
                settings: {
                    email: {
                        addresses: ['notify.me@email.com', 'notify.you@email.com'],
                        statuses: ['SUCCESS', 'FAILURE']
                    }
                },
                status: 'invalid_status'
            };

            serverMock.event('build_status_test');

            const saveMe = notifier.notify()
            .then(() => {
                assert.fail('Should not get here');
            })
            .catch((err) => {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            });

            serverMock.emit('build_status_test', buildDataMockUnincluded);

            return saveMe;
        });

        it('verifies that non-subscribed status does not send a notifcation', () => {
            const buildDataMockUnincluded = {
                settings: {
                    email: {
                        addresses: ['notify.me@email.com', 'notify.you@email.com'],
                        statuses: ['SUCCESS', 'FAILURE']
                    }
                },
                status: 'ABORTED'
            };

            serverMock.event('build_status_test');

            const saveMe = notifier.notify().then((res) => {
                assert.equal(res, null);
            });

            serverMock.emit('build_status_test', buildDataMockUnincluded);

            return saveMe;
        });

        it('sets addresses and statuses for simple email string config settings', () => {
            const buildDataMockSimple = {
                settings: {
                    email: 'notify.me@email.com'
                },
                status: 'FAILURE',
                pipelineName: 'screwdriver-cd/notifications',
                jobName: 'publish',
                buildId: '1234',
                buildLink: 'http://thisisaSDtest.com/builds/1234'
            };

            serverMock.event('build_status_test');

            const saveMe = notifier.notify().then(() => {
                assert.calledWith(nodemailerMock.createTransport,
                    { host: configMock.host, port: configMock.port });
            });

            serverMock.emit('build_status_test', buildDataMockSimple);

            return saveMe;
        });

        it('sets addresses and statuses for an array of emails in config settings', () => {
            const buildDataMockArray = {
                settings: {
                    email: ['notify.me@email.com', 'notify.you@email.com']
                },
                status: 'FAILURE',
                pipelineName: 'screwdriver-cd/notifications',
                jobName: 'publish',
                buildId: '1234',
                buildLink: 'http://thisisaSDtest.com/builds/1234'
            };

            serverMock.event('build_status_test');

            const saveMe = notifier.notify().then(() => {
                assert.calledWith(nodemailerMock.createTransport,
                    { host: configMock.host, port: configMock.port });
            });

            serverMock.emit('build_status_test', buildDataMockArray);

            return saveMe;
        });

        it('allows additional notifications plugins in buildData.settings', () => {
            buildDataMock.settings.hipchat = {
                awesome: 'sauce',
                catch: 22
            };

            serverMock.event('build_status_test');

            const saveMe = notifier.notify().then(() => {
                assert.calledWith(nodemailerMock.createTransport,
                    { host: configMock.host, port: configMock.port });
            });

            serverMock.emit('build_status_test', buildDataMock);

            return saveMe;
        });
    });

    describe('config and buildData are validated', () => {
        beforeEach(() => {
            nodemailerMock.createTransport.reset();

            serverMock = new Hapi.Server();
            configMock = {
                host: 'testing.aserver.com',
                port: 25,
                from: 'user@email.com'
            };
            buildDataMock = {
                settings: {
                    email: {
                        addresses: ['notify.me@email.com', 'notify.you@email.com'],
                        statuses: ['SUCCESS', 'FAILURE']
                    }
                },
                status: 'SUCCESS',
                pipelineName: 'screwdriver-cd/notifications',
                jobName: 'publish',
                buildId: '1234',
                buildLink: 'http://thisisaSDtest.com/builds/1234'
            };
        });

        it('validates host', () => {
            configMock.host = 22;
            try {
                notifier = new EmailNotifier(configMock, serverMock, 'build_status_test');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates port', () => {
            configMock.port = 'nonIntegerPort';
            try {
                notifier = new EmailNotifier(configMock, serverMock, 'build_status_test');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates the from email', () => {
            configMock.from = 'nonEmailString';
            try {
                notifier = new EmailNotifier(configMock, serverMock, 'build_status_test');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates config format', () => {
            configMock = ['this', 'is', 'wrong'];

            try {
                notifier = new EmailNotifier(configMock, serverMock, 'build_status_test');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });
    });

    describe('buildData is validated', () => {
        beforeEach(() => {
            nodemailerMock.createTransport.reset();

            serverMock = new Hapi.Server();
            configMock = {
                host: 'testing.aserver.com',
                port: 25,
                from: 'user@email.com'
            };
            buildDataMock = {
                settings: {
                    email: {
                        addresses: ['notify.me@email.com', 'notify.you@email.com'],
                        statuses: ['SUCCESS', 'FAILURE']
                    }
                },
                status: 'SUCCESS',
                pipelineName: 'screwdriver-cd/notifications',
                jobName: 'publish',
                buildId: '1234',
                buildLink: 'http://thisisaSDtest.com/builds/1234'
            };

            notifier = new EmailNotifier(configMock, serverMock, 'build_status_test');
        });

        it('validates status', () => {
            buildDataMock.status = 22;
            serverMock.event('build_status_test');

            const saveMe = notifier.notify().then(() => {
                assert.fail('should not get here');
            }, (err) => {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            });

            serverMock.emit('build_status_test', buildDataMock);

            return saveMe;
        });

        it('validates settings', () => {
            buildDataMock.settings = ['hello@world.com', 'goodbye@universe.com'];
            serverMock.event('build_status_test');
            const saveMe = notifier.notify().then(() => {
                assert.fail('should not get here');
            }, (err) => {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            });

            serverMock.emit('build_status_test', buildDataMock);

            return saveMe;
        });

        it('validates buildData format', () => {
            const buildDataMockInvalid = ['this', 'is', 'wrong'];

            serverMock.event('build_status_test');
            const saveMe = notifier.notify().then(() => {
                assert.fail('should not get here');
            }, (err) => {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            });

            serverMock.emit('build_status_test', buildDataMockInvalid);

            return saveMe;
        });
    });
});

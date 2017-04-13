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
    const eventMock = 'build_status_test';

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

        it('verifies that included status creates nodemailer transporter', (done) => {
            serverMock.event(eventMock);
            serverMock.on(eventMock, data => notifier.notify(data));
            serverMock.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                assert.calledWith(nodemailerMock.createTransport,
                    { host: configMock.host, port: configMock.port });
                done();
            });
        });

        it('verifies that non-included status returns null', (done) => {
            const buildDataMockUnincluded = {
                settings: {
                    email: {
                        addresses: ['notify.me@email.com', 'notify.you@email.com'],
                        statuses: ['SUCCESS', 'FAILURE']
                    }
                },
                status: 'invalid_status'
            };

            serverMock.event(eventMock);
            serverMock.on(eventMock, data => notifier.notify(data));
            serverMock.emit(eventMock, buildDataMockUnincluded);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });

        it('verifies that non-subscribed status does not send a notifcation', (done) => {
            const buildDataMockUnincluded = {
                settings: {
                    email: {
                        addresses: ['notify.me@email.com', 'notify.you@email.com'],
                        statuses: ['SUCCESS', 'FAILURE']
                    }
                },
                status: 'ABORTED'
            };

            serverMock.event(eventMock);
            serverMock.on(eventMock, data => notifier.notify(data));
            serverMock.emit(eventMock, buildDataMockUnincluded);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });

        it('sets addresses and statuses for simple email string config settings', (done) => {
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

            serverMock.event(eventMock);
            serverMock.on(eventMock, data => notifier.notify(data));
            serverMock.emit(eventMock, buildDataMockSimple);

            process.nextTick(() => {
                assert.calledWith(nodemailerMock.createTransport,
                    { host: configMock.host, port: configMock.port });
                done();
            });
        });

        it('sets addresses and statuses for an array of emails in config settings', (done) => {
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

            serverMock.event(eventMock);
            serverMock.on(eventMock, data => notifier.notify(data));
            serverMock.emit(eventMock, buildDataMockArray);

            process.nextTick(() => {
                assert.calledWith(nodemailerMock.createTransport,
                    { host: configMock.host, port: configMock.port });
                done();
            });
        });

        it('allows additional notifications plugins in buildData.settings', (done) => {
            buildDataMock.settings.hipchat = {
                awesome: 'sauce',
                catch: 22
            };

            serverMock.event(eventMock);
            serverMock.on(eventMock, data => notifier.notify(data));
            serverMock.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                assert.calledWith(nodemailerMock.createTransport,
                    { host: configMock.host, port: configMock.port });
                done();
            });
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

        it('validates status', (done) => {
            buildDataMock.status = 22;
            serverMock.event(eventMock);
            serverMock.on(eventMock, data => notifier.notify(data));
            serverMock.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });

        it('validates settings', (done) => {
            buildDataMock.settings = ['hello@world.com', 'goodbye@universe.com'];
            serverMock.event(eventMock);
            serverMock.on(eventMock, data => notifier.notify(data));
            serverMock.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });

        it('validates buildData format', (done) => {
            const buildDataMockInvalid = ['this', 'is', 'wrong'];

            serverMock.event(eventMock);
            serverMock.on(eventMock, data => notifier.notify(data));
            serverMock.emit(eventMock, buildDataMockInvalid);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });
    });
});

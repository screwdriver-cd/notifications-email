'use strict';

const Hapi = require('hapi');
const assert = require('chai').assert;
const mockery = require('mockery');
const sinon = require('sinon');

require('sinon-as-promised');

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

    describe('notifier listens to server emits', () => {
        before(() => {
            mockery.enable({
                useCleanCache: true,
                warnOnUnregistered: false
            });
        });

        after(() => {
            mockery.disable();
        });

        beforeEach(() => {
            nodemailerMock = getNodemailerMock();
            mockery.registerMock('nodemailer', nodemailerMock);

            // eslint-disable-next-line global-require
            const EmailNotifier = require('../index');

            serverMock = new Hapi.Server();
            configMock = {
                host: 'testing.aserver.com',
                port: 25,
                from: 'user@email.com'
            };
            buildDataMock = {
                settings: {
                    addresses: ['notify.me@email.com', 'notify.you@email.com'],
                    statuses: ['SUCCESS', 'FAILURE']
                },
                status: 'SUCCESS'
            };

            notifier = new EmailNotifier(configMock, serverMock, 'build_status_test');
        });

        afterEach(() => {
            mockery.deregisterAll();
            mockery.resetCache();
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
                    addresses: ['notify.me@email.com', 'notify.you@email.com'],
                    statuses: ['SUCCESS', 'FAILURE']
                },
                status: 'invalid_status'
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
                settings: 'joe@bloe.com',
                status: 'FAILURE'
            };

            serverMock.event('build_status_test');

            const saveMe = notifier.notify().then(() => {
                assert.calledWith(nodemailerMock.createTransport,
                    { host: configMock.host, port: configMock.port });
            });

            serverMock.emit('build_status_test', buildDataMockSimple);

            return saveMe;
        });
    });

    describe('config and buildData are validated', () => {
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

        beforeEach(() => {
            serverMock = new Hapi.Server();
            configMock = {
                host: 'testing.aserver.com',
                port: 25,
                from: 'user@email.com'
            };
            buildDataMock = {
                settings: {
                    addresses: ['notify.me@email.com', 'notify.you@email.com'],
                    statuses: ['SUCCESS', 'FAILURE']
                },
                status: 'SUCCESS'
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
        before(() => {
            mockery.enable({
                useCleanCache: true,
                warnOnUnregistered: false
            });

            nodemailerMock = getNodemailerMock();
            mockery.registerMock('nodemailer', nodemailerMock);
        });

        after(() => {
            mockery.disable();
        });

        beforeEach(() => {
            // eslint-disable-next-line global-require
            const EmailNotifier = require('../index');

            serverMock = new Hapi.Server();
            configMock = {
                host: 'testing.aserver.com',
                port: 25,
                from: 'user@email.com'
            };
            buildDataMock = {
                settings: {
                    addresses: ['notify.me@email.com', 'notify.you@email.com'],
                    statuses: ['SUCCESS', 'FAILURE']
                },
                status: 'SUCCESS'
            };

            notifier = new EmailNotifier(configMock, serverMock, 'build_status_test');
        });

        afterEach(() => {
            mockery.deregisterAll();
            mockery.resetCache();
        });

        it('validates status', () => {
            buildDataMock.status = 22;
            serverMock.event('build_status_test');
            try {
                const saveMe = notifier.notify().then(() => {
                    assert.calledWith(nodemailerMock.createTransport,
                        { host: configMock.host, port: configMock.port });
                });

                serverMock.emit('build_status_test', buildDataMock);

                return saveMe;
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');

                return err;
            }
        });

        it('validates settings', () => {
            buildDataMock.settings = ['hello@world.com', 'goodbye@universe.com'];
            serverMock.event('build_status_test');
            try {
                const saveMe = notifier.notify().then(() => {
                    assert.calledWith(nodemailerMock.createTransport,
                        { host: configMock.host, port: configMock.port });
                });

                serverMock.emit('build_status_test', buildDataMock);

                return saveMe;
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');

                return err;
            }
        });

        it('validates buildData format', () => {
            const buildDataMockInvalid = ['this', 'is', 'wrong'];

            serverMock.event('build_status_test');
            try {
                const saveMe = notifier.notify().then(() => {
                    assert.calledWith(nodemailerMock.createTransport,
                        { host: configMock.host, port: configMock.port });
                });

                serverMock.emit('build_status_test', buildDataMockInvalid);

                return saveMe;
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');

                return err;
            }
        });
    });
});

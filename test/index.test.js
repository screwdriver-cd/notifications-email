'use strict';

const Hapi = require('@hapi/hapi');
const { assert } = require('chai');
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
                pipeline: {
                    id: '123',
                    scmRepo: {
                        name: 'screwdriver-cd/notifications',
                        url: 'http://scmtest/master'
                    }
                },
                jobName: 'publish',
                build: {
                    id: '1234',
                    meta: {
                        build: {
                            sha: '123abc'
                        },
                        commit: {
                            changedFiles: 'foo.txt,bar,txt',
                            message: 'update something',
                            url: `https://ghe.corp.dummy/screwdriver-cd/
                                notifications/commit/85b159c5457441c9bc9ff1bc9944f4f6bbd1ff89`
                        }
                    }
                },
                event: {
                    id: '12345',
                    causeMessage: 'Merge pull request #26 from screwdriver-cd/notifications',
                    creator: { username: 'foo' },
                    commit: {
                        author: { name: 'foo' },
                        message: 'fixing a bug'
                    }
                },
                buildLink: 'http://thisisaSDtest.com/builds/1234',
                isFixed: false
            };
            notifier = new EmailNotifier(configMock, serverMock, 'build_status_test');
        });

        it('verifies that included status creates nodemailer transporter', done => {
            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(data));
            serverMock.events.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                assert.calledWith(nodemailerMock.createTransport, { host: configMock.host, port: configMock.port });
                done();
            });
        });

        it('when the build status is fixed, Overwrites the notification status title', done => {
            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(data));
            serverMock.events.emit(eventMock, buildDataMock);
            buildDataMock.isFixed = true;

            process.nextTick(() => {
                assert.calledWith(nodemailerMock.createTransport, { host: configMock.host, port: configMock.port });
                done();
            });
        });

        it('creates a nodemailer with auth when password and username are provided', done => {
            configMock.username = 'batman';
            configMock.password = 'robin';

            notifier = new EmailNotifier(configMock, serverMock, 'build_status_test');

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(data));
            serverMock.events.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                assert.calledWith(nodemailerMock.createTransport, {
                    host: configMock.host,
                    port: configMock.port,
                    auth: {
                        user: configMock.username,
                        pass: configMock.password
                    }
                });
                done();
            });
        });

        it('verifies that non-included status returns null', done => {
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
            serverMock.events.on(eventMock, data => notifier.notify(data));
            serverMock.events.emit(eventMock, buildDataMockUnincluded);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });

        it('verifies that non-subscribed status does not send a notification', done => {
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
            serverMock.events.on(eventMock, data => notifier.notify(data));
            serverMock.events.emit(eventMock, buildDataMockUnincluded);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });

        it(`sets addresses and statuses for simple
                email string config settings with no changed files`, done => {
            const buildDataMockSimple = {
                settings: {
                    email: 'notify.me@email.com'
                },
                status: 'FAILURE',
                pipeline: {
                    id: '123',
                    scmRepo: { name: 'screwdriver-cd/notifications' }
                },
                jobName: 'publish',
                build: {
                    id: '1234',
                    meta: {
                        build: {
                            sha: '123abc'
                        },
                        commit: {
                            changedFiles: '',
                            message: 'update something',
                            url: `https://ghe.corp.dummy/screwdriver-cd/
                                notifications/commit/85b159c5457441c9bc9ff1bc9944f4f6bbd1ff89`
                        }
                    }
                },
                event: {
                    id: '12345',
                    causeMessage: 'Merge pull request #26 from screwdriver-cd/notifications',
                    creator: { username: 'foo' },
                    commit: {
                        author: { name: 'foo' },
                        message: 'fixing a bug'
                    }
                },
                buildLink: 'http://thisisaSDtest.com/builds/1234'
            };

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(data));
            serverMock.events.emit(eventMock, buildDataMockSimple);

            process.nextTick(() => {
                assert.calledWith(nodemailerMock.createTransport, { host: configMock.host, port: configMock.port });
                done();
            });
        });

        it('sets addresses and statuses for simple email string config settings', done => {
            const buildDataMockSimple = {
                settings: {
                    email: 'notify.me@email.com'
                },
                status: 'FAILURE',
                pipeline: {
                    id: '123',
                    scmRepo: { name: 'screwdriver-cd/notifications' }
                },
                jobName: 'publish',
                build: {
                    id: '1234',
                    meta: {
                        build: {
                            sha: '123abc'
                        },
                        commit: {
                            changedFiles: 'foo.txt,bar,txt',
                            message: 'update something',
                            url: `https://ghe.corp.dummy/screwdriver-cd/
                                notifications/commit/85b159c5457441c9bc9ff1bc9944f4f6bbd1ff89`
                        }
                    }
                },
                event: {
                    id: '12345',
                    causeMessage: 'Merge pull request #26 from screwdriver-cd/notifications',
                    creator: { username: 'foo' },
                    commit: {
                        author: { name: 'foo' },
                        message: 'fixing a bug'
                    }
                },
                buildLink: 'http://thisisaSDtest.com/builds/1234'
            };

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(data));
            serverMock.events.emit(eventMock, buildDataMockSimple);

            process.nextTick(() => {
                assert.calledWith(nodemailerMock.createTransport, { host: configMock.host, port: configMock.port });
                done();
            });
        });

        it('sets addresses, statuses and srcDir for simple email string config', done => {
            const buildDataMockSimple = {
                settings: {
                    email: 'notify.me@email.com'
                },
                status: 'FAILURE',
                pipeline: {
                    id: '123',
                    scmRepo: { name: 'screwdriver-cd/notifications' },
                    rootDir: 'mydir'
                },
                jobName: 'publish',
                build: {
                    id: '1234',
                    meta: {
                        build: {
                            sha: '123abc'
                        },
                        commit: {
                            changedFiles: 'foo.txt,bar,txt',
                            message: 'update something',
                            url: `https://ghe.corp.dummy/screwdriver-cd/
                                notifications/commit/85b159c5457441c9bc9ff1bc9944f4f6bbd1ff89`
                        }
                    }
                },
                event: {
                    id: '12345',
                    causeMessage: 'Merge pull request #26 from screwdriver-cd/notifications',
                    creator: { username: 'foo' },
                    commit: {
                        author: { name: 'foo' },
                        message: 'fixing a bug'
                    }
                },
                buildLink: 'http://thisisaSDtest.com/builds/1234'
            };

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(data));
            serverMock.events.emit(eventMock, buildDataMockSimple);

            process.nextTick(() => {
                assert.calledWith(nodemailerMock.createTransport, { host: configMock.host, port: configMock.port });
                done();
            });
        });

        it('sets addresses and statuses for an array of emails in config settings', done => {
            const buildDataMockArray = {
                settings: {
                    email: ['notify.me@email.com', 'notify.you@email.com']
                },
                status: 'FAILURE',
                pipeline: {
                    id: '123',
                    scmRepo: { name: 'screwdriver-cd/notifications' }
                },
                jobName: 'publish',
                build: {
                    id: '1234',
                    meta: {
                        build: {
                            sha: '123abc'
                        },
                        commit: {
                            changedFiles: 'foo.txt,bar,txt',
                            message: 'update something',
                            url: `https://ghe.corp.dummy/screwdriver-cd/
                                notifications/commit/85b159c5457441c9bc9ff1bc9944f4f6bbd1ff89`
                        }
                    }
                },
                event: {
                    id: '12345',
                    causeMessage: 'Merge pull request #26 from screwdriver-cd/notifications',
                    creator: { username: 'foo' },
                    commit: {
                        author: { name: 'foo' },
                        message: 'fixing a bug'
                    }
                },
                buildLink: 'http://thisisaSDtest.com/builds/1234'
            };

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(data));
            serverMock.events.emit(eventMock, buildDataMockArray);

            process.nextTick(() => {
                assert.calledWith(nodemailerMock.createTransport, { host: configMock.host, port: configMock.port });
                done();
            });
        });

        it('allows additional notifications plugins in buildData.settings', done => {
            buildDataMock.settings.hipchat = {
                awesome: 'sauce',
                catch: 22
            };

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(data));
            serverMock.events.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                assert.calledWith(nodemailerMock.createTransport, { host: configMock.host, port: configMock.port });
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
                pipeline: {
                    id: '123',
                    scmRepo: {
                        name: 'screwdriver-cd/notifications'
                    }
                },
                jobName: 'publish',
                build: {
                    id: '1234'
                },
                event: {
                    id: '12345',
                    causeMessage: 'Merge pull request #26 from screwdriver-cd/notifications',
                    creator: { username: 'foo' },
                    commit: {
                        author: { name: 'foo' },
                        message: 'fixing a bug'
                    }
                },
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

        it('validates the username', () => {
            configMock.username = 22;
            try {
                notifier = new EmailNotifier(configMock, serverMock, 'build_status_test');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates the password', () => {
            configMock.password = 22;
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

        it('is valid config with complete parameters', () => {
            configMock = {
                email: {
                    addresses: ['notify.me@email.com', 'notify.you@email.com'],
                    statuses: ['SUCCESS', 'FAILURE']
                }
            };

            const res = EmailNotifier.validateConfig(configMock);

            assert.isUndefined(res.error);
        });

        it('is valid config with empty statuses', () => {
            configMock = {
                email: {
                    addresses: ['notify.me@email.com', 'notify.you@email.com'],
                    statuses: []
                }
            };

            const { error } = EmailNotifier.validateConfig(configMock);

            assert.isUndefined(error);
        });

        it('is valid config with addresses', () => {
            configMock = {
                email: {
                    addresses: ['notify.me@email.com', 'notify.you@email.com']
                }
            };

            const { error } = EmailNotifier.validateConfig(configMock);

            assert.isUndefined(error);
        });

        it('is invalid config with empty parameters', () => {
            configMock = {};
            const { error } = EmailNotifier.validateConfig(configMock);

            assert.instanceOf(error, Error);
            assert.equal(error.name, 'ValidationError');
        });

        it('valid config with empty email settings', () => {
            configMock = {
                email: {}
            };
            const { error } = EmailNotifier.validateConfig(configMock);

            assert.isUndefined(error);
        });

        it('valid config without addresses', () => {
            configMock = {
                email: {
                    statuses: ['SUCCESS', 'FAILURE']
                }
            };
            const { error } = EmailNotifier.validateConfig(configMock);

            assert.isUndefined(error);
        });

        it('invalid config with empty addresses', () => {
            configMock = {
                email: {
                    addresses: [],
                    statuses: ['SUCCESS', 'FAILURE']
                }
            };
            const { error } = EmailNotifier.validateConfig(configMock);

            assert.instanceOf(error, Error);
            assert.equal(error.name, 'ValidationError');
        });

        it('invalid unknown status', () => {
            configMock = {
                email: {
                    addresses: ['notify.me@email.com'],
                    statuses: ['DUMMY_STATUS']
                }
            };
            const { error } = EmailNotifier.validateConfig(configMock);

            assert.instanceOf(error, Error);
            assert.equal(error.name, 'ValidationError');
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
                pipeline: {
                    id: '123',
                    scmRepo: {
                        name: 'screwdriver-cd/notifications'
                    }
                },
                jobName: 'publish',
                build: {
                    id: '1234'
                },
                event: {
                    id: '12345',
                    causeMessage: 'Merge pull request #26 from screwdriver-cd/notifications',
                    creator: { username: 'foo' },
                    commit: {
                        author: { name: 'foo' },
                        message: 'fixing a bug'
                    }
                },
                buildLink: 'http://thisisaSDtest.com/builds/1234'
            };

            notifier = new EmailNotifier(configMock, serverMock, 'build_status_test');
        });

        it('validates status', done => {
            buildDataMock.status = 22;
            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(data));
            serverMock.events.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });

        it('validates settings', done => {
            buildDataMock.settings = ['hello@world.com', 'goodbye@universe.com'];
            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(data));
            serverMock.events.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });

        it('validates buildData format', done => {
            const buildDataMockInvalid = ['this', 'is', 'wrong'];

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(data));
            serverMock.events.emit(eventMock, buildDataMockInvalid);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });
    });
});

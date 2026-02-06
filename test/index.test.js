'use strict';

const Hapi = require('@hapi/hapi');
const { assert } = require('chai');
const mockery = require('mockery');
const sinon = require('sinon');

sinon.assert.expose(assert, { prefix: '' });

describe('index', () => {
    const sendMailMock = {
        sendMail: sinon.stub().yieldsAsync()
    };
    const nodemailerMock = {
        createTransport: sinon.stub().returns(sendMailMock)
    };
    let serverMock;
    let configMock;
    let notifier;
    let buildDataMock;
    let jobDataMock;
    let EmailNotifier;
    let eventMock;

    before(() => {
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });

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
            nodemailerMock.createTransport.returns(sendMailMock);

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
            notifier = new EmailNotifier(configMock, serverMock, 'build_status');
            eventMock = 'build_status';
        });

        it('verifies that included status creates nodemailer transporter', done => {
            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
            serverMock.events.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                assert.calledWith(nodemailerMock.createTransport, { host: configMock.host, port: configMock.port });
                done();
            });
        });

        it('when the build status is fixed, Overwrites the notification status title', done => {
            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
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

            notifier = new EmailNotifier(configMock, serverMock, 'build_status');

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
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
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
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
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
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
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
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
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
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
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
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
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
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
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
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
            nodemailerMock.createTransport.returns(sendMailMock);

            serverMock = new Hapi.Server();
            configMock = {
                host: 'testing.aserver.com',
                port: 25,
                from: 'user@email.com'
            };
        });

        it('validates host', () => {
            configMock.host = 22;
            try {
                notifier = new EmailNotifier(configMock, serverMock, 'build_status');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates port', () => {
            configMock.port = 'nonIntegerPort';
            try {
                notifier = new EmailNotifier(configMock, serverMock, 'build_status');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates the from email', () => {
            configMock.from = 'nonEmailString';
            try {
                notifier = new EmailNotifier(configMock, serverMock, 'build_status');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates the username', () => {
            configMock.username = 22;
            try {
                notifier = new EmailNotifier(configMock, serverMock, 'build_status');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates the password', () => {
            configMock.password = 22;
            try {
                notifier = new EmailNotifier(configMock, serverMock, 'build_status');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates config format', () => {
            configMock = ['this', 'is', 'wrong'];

            try {
                notifier = new EmailNotifier(configMock, serverMock, 'build_status');
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
            nodemailerMock.createTransport.returns(sendMailMock);

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

            notifier = new EmailNotifier(configMock, serverMock, 'build_status');
        });

        it('validates status', done => {
            buildDataMock.status = 22;
            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
            serverMock.events.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });

        it('validates settings', done => {
            buildDataMock.settings = ['hello@world.com', 'goodbye@universe.com'];
            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
            serverMock.events.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });

        it('validates buildData format', done => {
            const buildDataMockInvalid = ['this', 'is', 'wrong'];

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
            serverMock.events.emit(eventMock, buildDataMockInvalid);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });
    });

    describe('config and payload for job event are validated', () => {
        beforeEach(() => {
            nodemailerMock.createTransport.reset();
            nodemailerMock.createTransport.returns(sendMailMock);

            serverMock = new Hapi.Server();
            configMock = {
                host: 'testing.aserver.com',
                port: 25,
                from: 'user@email.com'
            };
            jobDataMock = {
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
                message: 'something went wrong',
                buildLink: 'http://thisisaSDtest.com/pipeline/1234'
            };
            notifier = new EmailNotifier(configMock, serverMock, 'job_status');
            eventMock = 'job_status';
        });

        it('validates host', () => {
            configMock.host = 22;
            try {
                notifier = new EmailNotifier(configMock, serverMock, 'job_status');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates port', () => {
            configMock.port = 'nonIntegerPort';
            try {
                notifier = new EmailNotifier(configMock, serverMock, 'job_status');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates the from email', () => {
            configMock.from = 'nonEmailString';
            try {
                notifier = new EmailNotifier(configMock, serverMock, 'job_status');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates the username', () => {
            configMock.username = 22;
            try {
                notifier = new EmailNotifier(configMock, serverMock, 'job_status');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates the password', () => {
            configMock.password = 22;
            try {
                notifier = new EmailNotifier(configMock, serverMock, 'job_status');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates config format', () => {
            configMock = ['this', 'is', 'wrong'];

            try {
                notifier = new EmailNotifier(configMock, serverMock, 'job_status');
                assert.fail('should not get here');
            } catch (err) {
                assert.instanceOf(err, Error);
                assert.equal(err.name, 'ValidationError');
            }
        });

        it('validates status', done => {
            jobDataMock.status = 22;
            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
            serverMock.events.emit(eventMock, jobDataMock);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });

        it('validates settings', done => {
            jobDataMock.settings = ['hello@world.com', 'goodbye@universe.com'];
            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
            serverMock.events.emit(eventMock, jobDataMock);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });

        it('validates jobData format', done => {
            const jobDataMockInvalid = ['this', 'is', 'wrong'];

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
            serverMock.events.emit(eventMock, jobDataMockInvalid);

            process.nextTick(() => {
                assert.notCalled(nodemailerMock.createTransport);
                done();
            });
        });
    });

    describe('Security - HTML Injection Prevention', () => {
        beforeEach(() => {
            sendMailMock.sendMail.reset();
            nodemailerMock.createTransport.reset();
            nodemailerMock.createTransport.returns(sendMailMock);

            serverMock = new Hapi.Server();
            configMock = {
                host: 'testing.aserver.com',
                port: 25,
                from: 'user@email.com'
            };

            notifier = new EmailNotifier(configMock, serverMock, 'build_status');
            eventMock = 'build_status';

            // Common buildDataMock setup
            buildDataMock = {
                settings: {
                    email: {
                        addresses: ['notify.me@email.com'],
                        statuses: ['FAILURE']
                    }
                },
                status: 'FAILURE',
                pipeline: {
                    id: '123',
                    scmRepo: {
                        name: 'screwdriver-cd/notifications'
                    }
                },
                jobName: 'publish',
                build: {
                    id: '1234',
                    meta: {
                        commit: {
                            changedFiles: 'normal_file.js'
                        }
                    }
                },
                event: {
                    id: '12345',
                    commit: {
                        message: 'Normal commit message',
                        url: 'https://github.com/test/repo/commit/abc123'
                    },
                    sha: 'abc1234567890'
                },
                buildLink: 'http://thisisaSDtest.com/builds/1234',
                isFixed: false
            };
        });

        it('should escape HTML injection in commit message', done => {
            buildDataMock.event.commit.message =
                '<img src=x onerror="alert(\'XSS in commit message\')">Malicious commit';

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
            serverMock.events.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                assert.calledOnce(sendMailMock.sendMail);

                const emailHtml = sendMailMock.sendMail.getCall(0).args[0].html;

                // Verify that the HTML injection attempt is escaped
                assert.notInclude(
                    emailHtml,
                    '<img src=x onerror="alert(\'XSS in commit message\')">',
                    'Raw HTML should be escaped'
                );
                assert.include(emailHtml, '&lt;img src=x onerror=', 'HTML should be escaped with entities');
                done();
            });
        });

        it('should escape script tags in commit message', done => {
            buildDataMock.build.meta.commit.changedFiles = 'file.js';
            buildDataMock.event.commit.message = '<script>alert("XSS")</script>Fix bug';

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
            serverMock.events.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                const emailHtml = sendMailMock.sendMail.getCall(0).args[0].html;

                // Verify that script tags are escaped
                assert.notInclude(emailHtml, '<script>alert("XSS")</script>', 'Script tags should be escaped');
                assert.include(emailHtml, '&lt;script&gt;', 'Script tag should be escaped with entities');
                done();
            });
        });

        it('should escape HTML in file names to prevent XSS', done => {
            buildDataMock.build.meta.commit.changedFiles =
                '<script>alert("XSS")</script>.js,<img src=x onerror=alert(1)>.txt';
            buildDataMock.event.commit.message = 'Update files';

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
            serverMock.events.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                const emailHtml = sendMailMock.sendMail.getCall(0).args[0].html;

                // Verify that HTML in file names is escaped
                assert.notInclude(
                    emailHtml,
                    '<script>alert("XSS")</script>.js',
                    'Script tag in filename should be escaped'
                );
                assert.notInclude(emailHtml, '<img src=x onerror=alert(1)>', 'IMG tag in filename should be escaped');
                assert.include(emailHtml, '&lt;script&gt;', 'File name HTML should be escaped');
                done();
            });
        });

        it('should escape multiple special characters', done => {
            buildDataMock.settings.email.statuses = ['SUCCESS'];
            buildDataMock.status = 'SUCCESS';
            buildDataMock.build.meta.commit.changedFiles = 'file<test>.js';
            buildDataMock.event.commit.message = 'Test <>&"\'/commit';

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
            serverMock.events.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                const emailHtml = sendMailMock.sendMail.getCall(0).args[0].html;

                // Verify that special characters are escaped
                assert.include(emailHtml, '&lt;', 'Less than should be escaped');
                assert.include(emailHtml, '&gt;', 'Greater than should be escaped');
                assert.include(emailHtml, '&amp;', 'Ampersand should be escaped');
                assert.include(emailHtml, '&quot;', 'Double quote should be escaped');
                assert.include(emailHtml, '&#x27;', 'Single quote should be escaped');
                done();
            });
        });

        it('should escape both commit message and file names in combined attack', done => {
            buildDataMock.build.meta.commit.changedFiles = '<iframe src="evil.com"></iframe>.js';
            buildDataMock.event.commit.message = '<svg onload="alert(\'XSS\')">Malicious SVG commit';

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
            serverMock.events.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                const emailHtml = sendMailMock.sendMail.getCall(0).args[0].html;

                // Verify both attack vectors are escaped
                assert.notInclude(emailHtml, '<iframe src="evil.com"></iframe>', 'iframe tag should be escaped');
                assert.notInclude(emailHtml, '<svg onload="alert(\'XSS\')">', 'SVG tag should be escaped');
                assert.include(emailHtml, '&lt;iframe', 'iframe should be HTML escaped');
                assert.include(emailHtml, '&lt;svg', 'SVG should be HTML escaped');
                done();
            });
        });

        it('should preserve normal commit messages without HTML', done => {
            buildDataMock.settings.email.statuses = ['SUCCESS'];
            buildDataMock.status = 'SUCCESS';
            buildDataMock.build.meta.commit.changedFiles = 'src/index.js,test/index.test.js';
            buildDataMock.event.commit.message = 'Fix bug in authentication logic';

            serverMock.event(eventMock);
            serverMock.events.on(eventMock, data => notifier.notify(eventMock, data));
            serverMock.events.emit(eventMock, buildDataMock);

            process.nextTick(() => {
                const emailHtml = sendMailMock.sendMail.getCall(0).args[0].html;

                // Verify normal content is preserved
                assert.include(
                    emailHtml,
                    'Fix bug in authentication logic',
                    'Normal commit message should be included'
                );
                assert.include(emailHtml, 'src/index.js', 'Normal file names should be included');
                assert.include(emailHtml, 'test/index.test.js', 'Normal file names should be included');
                done();
            });
        });
    });
});

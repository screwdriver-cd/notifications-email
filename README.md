# Notifications (Email)
[![Version][npm-image]][npm-url] ![Downloads][downloads-image] [![Build Status][status-image]][status-url] [![Open Issues][issues-image]][issues-url] [![Dependency Status][daviddm-image]][daviddm-url] ![License][license-image]

> Sends email notifications on certain build events.

## Usage

```bash
npm install screwdriver-notifications-email
```
### Initialization

The class has a variety of knobs to tweak when interacting with Email Notifications.

| Parameter        | Type  |  Description |
| :-------------   | :---- | :-------------|
| config        | Object | Configuration Object |
| config.host | String | SMTP Host URL |
| config.port | Number | Port to use when connecting to SMTP |
| config.from | String | Sender email address |

The interface looks for email-specific build data:

| Parameter        | Type  |  Description |
| :-------------   | :---- | :-------------|
| buildData        | Object | Build Data Object |
| buildData.status | String | Build status update for notification |
| buildData.settings | Object | Pluggable settings for each build |
| buildData.settings.email | Object | Email-specific settings |
| buildData.pipelineName | String | Name of your pipeline |
| buildData.jobName | String | Job this email is being sent for |
| buildData.buildId | Number | Build number this email is being sent for |
| buildData.buildLink | String | Link to build |

buildData.settings.email can take either:

#### Simple Config

```js
buildData.settings.email = 'notify.me@email.com'
```

#### Advanced Config

```js
buildData.settings.email = {
    addresses: ['notify.me@email.com', 'notify.you@email.com'], // Multiple recipient addresses
    statuses: ['SUCCESS', 'FAILURE'] // Build statuses to notify addresses about
}
```

## Testing

```bash
npm test
```

## License

Code licensed under the BSD 3-Clause license. See LICENSE file for terms.

[npm-image]: https://img.shields.io/npm/v/screwdriver-notifications-email.svg
[npm-url]: https://npmjs.org/package/screwdriver-notifications-email
[downloads-image]: https://img.shields.io/npm/dt/screwdriver-notifications-email.svg
[license-image]: https://img.shields.io/npm/l/screwdriver-notifications-email.svg
[issues-image]: https://img.shields.io/github/issues/screwdriver-cd/notifications-email.svg
[issues-url]: https://github.com/screwdriver-cd/notifications-email/issues
[status-image]: https://cd.screwdriver.cd/pipelines/89/badge
[status-url]: https://cd.screwdriver.cd/pipelines/89
[daviddm-image]: https://david-dm.org/screwdriver-cd/notifications-email.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/screwdriver-cd/notifications-email

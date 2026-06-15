# Intelligent Talent Matching Platform

## Project Overview

The Intelligent Talent Matching Platform is a web application designed to connect candidates and employers through searchable profiles, job postings, applications, company management, and administrative tools.

The platform supports candidate accounts, employer accounts, flexible candidate/employer accounts, and administrator workflows for managing users, notifications, sessions, suspensions, and platform activity.

## Project Features

- Candidate registration, login, profile management, and job discovery.
- Employer registration, company profiles, job postings, and candidate search.
- Job applications, saved jobs, application tracking, and employer-side application management.
- Company member management and employer collaboration tools.
- Notifications with read, clear, and audit functionality.
- Admin user management, suspensions, throttling, session tracking, and impersonation.
- Secure session handling, guarded server requests, upload safeguards, and request timeouts.
- Light and dark theme support.

## Technology Stack

- Node.js
- Express.js
- TypeScript
- EJS templates
- PostgreSQL
- Prisma ORM
- Docker and Docker Compose
- jQuery
- Font Awesome
- Toastr

## Getting Started

Clone the repository and install dependencies:

```bash
npm install
```

Create a local `.env` file using the expected environment variables for the application, PostgreSQL, sessions, and pgAdmin. See `.env.example` if available in your local copy.

Generate the Prisma client:

```bash
npm run prisma:generate
```

## Running the Project

Build the project:

```bash
npm run build
```

Run the application with Docker:

```bash
npm run docker:up
```

Stop the Docker stack:

```bash
npm run docker:down
```

View Docker logs:

```bash
npm run docker:logs
```

Run database migrations during development:

```bash
npm run prisma:migrate
```

Deploy migrations:

```bash
npm run prisma:deploy
```

When running locally through Docker, the application is typically available at:

```text
http://localhost:3000
```

pgAdmin is typically available at:

```text
http://localhost:5050
```

## Contributing

Contributions should follow the project license and must preserve attribution to the original authors.

Before contributing:

- Review the project structure and existing coding patterns.
- Keep changes focused and relevant to the issue or feature being worked on.
- Test changes locally before submitting.
- Avoid committing secrets, credentials, local environment files, generated build output, or unrelated editor files.

## Reporting Issues & Bugs

Please report issues with clear reproduction steps and relevant context.

Helpful bug reports include:

- What happened.
- What you expected to happen.
- Steps to reproduce the issue.
- Screenshots or console output, if relevant.
- Browser, operating system, and environment details.
- Any related logs or error messages.

## Acknowledgments

This project is part of the CSIT314 Software Development Methodologies course.

Special thanks to our team members and contributors.

## License

This project is licensed under the ITMP License Version 1.0 - June 2026.

See [LICENSE.md](LICENSE.md) for full details.

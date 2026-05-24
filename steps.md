# Ticket management system

## Before start development Framework

1. Define the scope - @project-scope.md
2. Clarify the requirements - @specification.md
3. Define the MVP
4. Choose the tech stack - @tech-stack.md
5. Create the implementation plan (what do we build first, second and so on) - @implementation-plan.md

## Notes for Claude

- #do not update step.md file using Claude Code, it's my internal file which is used to prepare the notes of developing the application.

## Scaffolding (Define the scope)

- Create `project-scope.md` of scope of work, before creating anything even before /init command. Add these sections (##Problem, ##Solution, ##Features)
- Enter the specification in the @project-scope.md as requirement.
- Launch Claude and enter the first prompt: read @project-scope.md. Review it and ask me clarifying questions. Help me find gaps or things I have not thought through
- Read the Claude responses and provide the answer in the prompts against those questions.
- After this work on Minimal Viable Product in v1.0. Build a well tested app first intead of lots of features. Decide timeline, budget, team. In this application our initial specification covers the MVP for the first release.
- Prompt: Review and Suggest tech stack for this project (Claude has already created this question in the specification), in this course, the author is using express. We'll try to use ASP.NET CORE, play with Claude prompt to create tech-stack.md file and review.
- Review the specification again to plan development priority, suppose user management can be developed later, first develop the project core requirement ticket management.
- Prompt: Create an implementation plan, break the project into small tasks and group them in phases.
- Prompt (DID NOT COMPLETED LATER TO CHECK THIS): check for testing the mail functionality locally without external smtp provider, check for locally smtp fake provider which can provide incoming/outgoing webhooks which can replicate the production grade email providers to test this functionality locally and also support front-end to do email compose or view mails locally, dummy mails
- Review the implementation-plan and remove the steps which are not to be execute. Do not proceed with suggested implementation plan. We can remove user management at the initial stage and prioritize other core ticket management functionalities (as per business prioritizes)


## Implementation of project

- Create a full stack project as per @specification.md and implement phase 0.
- Use context7 for up-to-date documentation.
- Tried to install docker images: Configure PostgreSQL, Redis, and attachment storage: during implementation of phase 0, it was not completed: Configure PostgreSQL, Redis, and attachment storage
- create the docker images and containers on my local docker-desktop
- in the client app, in app component, write code to call the healthcheck api and display a message.
- Create a shell command to run both first the dotnet server app and after that client react app, so that I can run them to test the application.
- # run ./dev.ps1 and check both app are working, if required fix the issue with claude code.
- create the project memory file claude.md. add context7 to fetch up-to-date documentation
- ensure that this @CLAUDE.md contains reference of all my existing md files like @implementation-plan.md @tech-stack.md  @specification.md and @project-scope.md
- # for this project do not need Prisma in this project.Prisma is an ORM for Node.js/TypeScript backends. Your backend is ASP.NET Core with EF Core, which is the .NET equivalent
- the postgresql is creating the table names in Pascal case which is creating problem when querying the data table, setup the mapping and skill that it should adhere the postgres naming conventions
- # No, you don't need better-auth. better-auth is a JavaScript/TypeScript auth library — it only works in Node.js backends. Your backend is ASP.NET Core, which already has ASP.NET Identity built in and configured in this project. It handles
- TODO: Check for authentication middleware in the react application to ensure that authentication is used.
- # instead of installing better-auth, here we'll use standard react-router-dom for managing authentication.
- install the react-router-dom and protect the front-end react-app routes and pages/components with best practices
- create a new users in the backend api application in development stage with username (email): test@test.com and password: Password@123
- # curl -s -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d "{\"displayName\":\"Test User\",\"email\":\"test@test.com\",\"password\":\"Password@123\"}" | cat
- # check if not working then let claude code to fix this and restart the application.
- create a new api in the backend api: "/api/me" which returns the current user logged-in and the token
- # we'll create the user from backend with super-admin logins to create other new users so disable the signup page.
- disable the signup endpoint, we'll create the new users/agent from the super admin user created in the system from backend. New users should not be able to signup them self
- Create the seed script to populate the database with an admin user, a user can be an admin or an agent. email: admin@example.com password: Password@123 store email and password in an enviornment variable.
- Create the seed script to populate the database with an agent user, email: agent@example.com password: Password@123
- define an enum for the role
- The status enum is stored as integer in the database, change all the enum to stored as text at database level, update that in the skill of this project for future reference.
- 

## Creating the login page

- build the login page, when the user logs in, redirect them to the home page and show the user's name in the nav bar along with a sign out button.
- Review the code changes and commit.
- # Implement react-hook-form for better validation with zod.
- use react hook form with zod.
- # implement red-border if there is a validation
- if a field is invalid, show a red border around that field.
- implement this red border pattern throughout this front-end application, add that in the skill field.
- bug: if we provide an invalid email, zod validation error is not displayed.
- 
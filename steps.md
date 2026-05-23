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
- 
# Ticket management system

## Before start development Framework

1. Define the scope
2. Clarify the requirements
3. Define the MVP
4. Choose the tech stack
5. Create the implementation plan (what do we build first, second and so on)

## Scaffolding (Define the scope)

- Create `project-scope.md` of scope of work, before creating anything even before /init command. Add these sections (##Problem, ##Solution, ##Features)
- Enter the specification in the @project-scope.md as requirement.
- Launch Claude and enter the first prompt: read @project-scope.md. Review it and ask me clarifying questions. Help me find gaps or things I have not thought through
- Read the Claude responses and provide the answer in the prompts against those questions.
- After this work on Minimal Viable Product in v1.0. Build a well tested app first intead of lots of features. Decide timeline, budget, team. In this application our initial specification covers the MVP for the first release.
- Prompt: Review and Suggest tech stack for this project (Claude has already created this question in the specification), in this course, the author is using express. We'll try to use ASP.NET CORE, play with Claude prompt to create tech-stack.md file and review.
- Review the specification again to plan development priority, suppose user management can be developed later, first develop the project core requirement ticket management.
- Prompt: Create an implementation plan, break the project into small tasks and group them in phases.
- 
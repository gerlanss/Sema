# Database Boundary

The public Sema CLI does not require a database.

Sema reads contracts and source files from the local workspace. Any database used
by an application governed by Sema belongs to that application, not to the public
Sema CLI distribution.

## Public Rule

Do not ship private database material, real credentials, operational schemas, or
project-specific data in the public Sema package.

Application-specific database docs should live in the application repository
that owns the database.

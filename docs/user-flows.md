# Screens and User Flows

## 1. Web screens

| Route | Screen | Access | Contents |
|---|---|---|---|
| `/login` | Login | public | Email, password, link to register |
| `/register` | Register | public | Full name, email, password |
| `/dashboard` | Dashboard | protected | Five statistic cards, links to projects and tasks |
| `/projects` | Project list | protected | Search by name, filter by status, create button, project cards |
| `/projects/new` | Create project | protected | Project form |
| `/projects/[id]` | Project detail | protected | Project info, edit/delete actions, task list with search and filters, add task |
| `/projects/[id]/edit` | Edit project | protected | Project form pre-filled |
| `/tasks` | All tasks | protected | Tasks across projects, search, status and priority filters |
| `/tasks/new?projectId=` | Create task | protected | Task form (project chosen from the user's projects) |
| `/tasks/[id]/edit` | Edit task | protected | Task form pre-filled (project shown, not editable) |

Shared layout for protected pages: header with app name, navigation (Dashboard, Projects, Tasks), current user name and logout.

## 2. Mobile screens

| Screen | Contents |
|---|---|
| Login | Email, password, link to register |
| Register | Full name, email, password |
| Dashboard | Five statistic cards, pull-to-refresh |
| Projects | Read-only project list with status, pull-to-refresh |
| Project detail | Project info and its tasks, add task button, pull-to-refresh |
| Tasks | All tasks, search, status and priority filters, pull-to-refresh |
| Task form | Create or edit: name, description, priority, status, due date |
| Task detail / actions | Mark completed, change status, change priority, edit, delete (with confirmation) |

Navigation: bottom tabs for Dashboard, Projects, Tasks; logout from the header or a profile menu.

## 3. Shared UI states

Every data screen handles:

- Loading: spinner or skeleton on first load; inline indicator on refresh
- Empty: message and a primary action (for example "No tasks yet. Add a task.")
- Error: readable message and Retry
- Offline (mobile): "No internet connection" message and Retry
- Session expired: redirect to login with "Your session has expired. Please log in again."

## 4. Main flows

### F1. Register and start (web or mobile)
1. User opens Register and submits full name, email and password.
2. Client validates the form; API validates again.
3. On success the user is logged in (PD-16) and lands on the dashboard.
4. On a duplicate email the form shows "An account with this email already exists."

### F2. Login and logout
1. User submits email and password.
2. On success: dashboard. On failure: "Invalid email or password."
3. Logout ends only the current session (PD-18) and returns to login.

### F3. Manage projects (web)
1. Projects page lists own projects, newest first.
2. Create: fill the form, submit, return to the project detail.
3. Edit: change fields, submit, see updated detail.
4. Delete: confirm dialog states that all tasks in the project will also be deleted; on confirm, return to the project list.

### F4. Manage tasks (web and mobile)
1. From a project detail, add a task.
2. Edit a task's fields, or change status/priority from the task actions. Quick actions send the complete task with the changed field through `PUT` (PD-07).
3. Mark completed sets status to `COMPLETED` the same way.
4. Delete asks for confirmation.

### F5. Search and filter
1. User types in the search box; results update after a short pause (debounced).
2. Status and priority filters combine with the search text.
3. Clearing all inputs shows the full list again.

### F6. Cross-platform sync (demo flow)
1. Log in with the same account on web and mobile.
2. Create a task on web.
3. Pull to refresh on mobile; the task appears.
4. Mark it completed on mobile.
5. Refresh on web; the task shows as completed and dashboard counts update.

### F7. Session expiry (mobile)
1. The API rejects a request because the token expired or was revoked.
2. The app deletes the stored token and opens the login screen with the session-expired message.

### F8. No network (mobile)
1. A request fails because the device is offline or the server cannot be reached.
2. The screen shows a clear message with Retry; previously loaded content stays visible where available.

import { useState } from "react";
import TaskList from "./TaskList";
import ProgressBar from "./ProgressBar";
import Navbar from "./Navbar";
import AddTaskForm from "./AddTaskForm";
import Profile from "./Profile";
import WeatherWidget from "./WeatherWidget";
import "./App.css";

const TASKS_API = "https://testapi.io/api/Boombonke/resource/Tasklist";
const USERS_API = "https://testapi.io/api/Boombonke/resource/Username";

function normalizeTask(task) {
  const source = task?.record ?? task?.data ?? task?.task ?? task ?? {};
  const fields = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value]),
  );
  return {
    ...source,
    id: fields.id ?? fields._id ?? fields.key,
    title: fields.title ?? fields.name ?? fields.task ?? "",
    status: fields.status || "Nepradėta",
    deadline: fields.deadline ?? fields.duedate ?? "",
    ownerUsername: fields.username ?? fields.ownerusername ?? fields.owner ?? "",
    ownerId: fields.userid ?? fields.ownerid ?? "",
  };
}

function normalizeUser(user) {
  const source = user?.record ?? user?.data ?? user?.user ?? user ?? {};
  const fields = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value]),
  );
  return {
    ...source,
    id: fields.id ?? fields._id ?? fields.key,
    name: fields.name ?? fields.fullname ?? "",
    username: fields.username ?? fields.login ?? fields.user ?? fields.name ?? "",
    email: fields.email ?? fields.emailaddress ?? "",
    password: fields.password ?? fields.pass ?? fields.userpassword ?? "",
  };
}

function getUserList(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const key of ["records", "data", "users", "items", "results", "value"]) {
    if (Array.isArray(data[key])) return data[key];
    if (data[key] && typeof data[key] === "object") {
      const nested = getUserList(data[key]);
      if (nested.length) return nested;
    }
  }
  return data.id || data.Id || data._id || data.Email || data.email || data.Username || data.username
    ? [data]
    : [];
}

function matchesAccount(user, identifier, password) {
  const account = normalizeUser(user);
  const normalizedIdentifier = identifier.trim().toLowerCase();
  return (
    (String(account.email).trim().toLowerCase() === normalizedIdentifier ||
      String(account.username).trim().toLowerCase() === normalizedIdentifier) &&
    String(account.password) === password
  );
}

async function readResponse(response) {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Serverio klaida (${response.status})`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activePage, setActivePage] = useState("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [userError, setUserError] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadTasks(account) {
    setLoading(true);
    setApiError("");
    try {
      const response = await fetch(TASKS_API);
      const data = await readResponse(response);
      const list = Array.isArray(data) ? data : data?.records ?? data?.data ?? data?.tasks ?? data?.items ?? [];
      const username = String(account?.username || "").trim().toLowerCase();
      const userId = String(account?.id ?? "");
      const ownedTasks = list.map(normalizeTask).filter((task) =>
        String(task.ownerUsername).trim().toLowerCase() === username ||
        (userId && String(task.ownerId) === userId),
      );
      setTasks(ownedTasks);
    } catch (error) {
      setApiError(`Nepavyko įkelti užduočių. ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    authenticateUser();
  }

  async function authenticateUser() {
    setUsersLoading(true);
    setLoginError("");
    try {
      const response = await fetch(USERS_API);
      const data = await readResponse(response);
      const list = getUserList(data);
      const normalizedUsers = list.map(normalizeUser);
      const matchingIdentifier = normalizedUsers.find((candidate) =>
        String(candidate.username).trim().toLowerCase() === email.trim().toLowerCase(),
      );
      if (matchingIdentifier && !matchingIdentifier.password) {
        setLoginError(`Paskyra rasta duomenų bazėje, bet API negrąžina slaptažodžio lauko (gauti laukai: ${Object.keys(matchingIdentifier).join(", ")}).`);
        return;
      }
      const account = normalizedUsers.find((candidate) => matchesAccount(candidate, email, password));
      if (!account) {
        setLoginError(matchingIdentifier
          ? "Vartotojas rastas duomenų bazėje, bet slaptažodis nesutampa. Patikrinkite įvestą slaptažodį arba Username API Password lauką."
          : "Tokio el. pašto ar vartotojo vardo duomenų bazėje nėra. Patikrinkite, ar registracija buvo sėkminga.");
        return;
      }
      setCurrentUser(account);
      await loadTasks(account);
      setIsLoggedIn(true);
    } catch (error) {
      setLoginError(`Nepavyko patikrinti paskyros: ${error.message}`);
    } finally {
      setUsersLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setAccountSaving(true);
    setUserError("");
    try {
      const username = registerUsername.trim();
      const response = await fetch(USERS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Name: username, Username: username, Password: registerPassword }),
      });
      await readResponse(response);
      const listResponse = await fetch(USERS_API, { cache: "no-store" });
      const data = await readResponse(listResponse);
      const list = getUserList(data);
      const newAccount = list.map(normalizeUser).find((account) =>
        account.username.trim().toLowerCase() === username.toLowerCase(),
      );
      if (!newAccount?.id) {
        throw new Error("Paskyra nebuvo rasta duomenų bazėje po sukūrimo. Patikrinkite Username API laukų pavadinimus.");
      }
      setRegisterUsername("");
      setRegisterPassword("");
      setEmail(newAccount.username);
      setPassword("");
      setAuthMode("login");
      setLoginError("Registracija sėkminga. Dabar galite prisijungti.");
    } catch (error) {
      setUserError(`Nepavyko užregistruoti paskyros: ${error.message}`);
    } finally {
      setAccountSaving(false);
    }
  }

  async function handleUpdateUser(changes) {
    if (!currentUser?.id) return;
    setAccountSaving(true);
    setUserError("");
    try {
      const updatedUser = { ...currentUser, ...changes };
      const response = await fetch(`${USERS_API}/${encodeURIComponent(currentUser.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Name: updatedUser.name, Username: updatedUser.username, Email: updatedUser.email, Password: updatedUser.password }),
      });
      const result = await readResponse(response);
      setCurrentUser(result ? normalizeUser(result) : updatedUser);
    } catch (error) {
      setUserError(`Nepavyko atnaujinti paskyros: ${error.message}`);
    } finally {
      setAccountSaving(false);
    }
  }

  async function handleDeleteUser() {
    if (!currentUser?.id) return;
    setAccountSaving(true);
    setUserError("");
    try {
      const response = await fetch(`${USERS_API}/${encodeURIComponent(currentUser.id)}`, { method: "DELETE" });
      await readResponse(response);
      setCurrentUser(null);
      setIsLoggedIn(false);
      setActivePage("home");
      setEmail("");
      setPassword("");
      setLoginError("Paskyra ištrinta.");
    } catch (error) {
      setUserError(`Nepavyko ištrinti paskyros: ${error.message}`);
    } finally {
      setAccountSaving(false);
    }
  }

  function handleLogout() {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setTasks([]);
    setActivePage("home");
    setEmail("");
    setPassword("");
    setLoginError("");
    setAuthMode("login");
  }

  async function handleAddTask(newTask) {
    setSaving(true);
    setApiError("");
    try {
      const response = await fetch(TASKS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Title: newTask.title,
          Status: newTask.status,
          Deadline: newTask.deadline,
          Username: currentUser.username,
          UserId: currentUser.id,
        }),
      });
      const created = await readResponse(response);
      const createdTask = {
        ...normalizeTask(created),
        title: newTask.title,
        status: newTask.status,
        deadline: newTask.deadline,
        ownerUsername: currentUser.username,
        ownerId: currentUser.id,
      };
      if (createdTask.id !== undefined) {
        setTasks((current) => [...current, createdTask]);
      } else {
        const listResponse = await fetch(TASKS_API);
        const listData = await readResponse(listResponse);
        const list = Array.isArray(listData) ? listData : listData?.records ?? listData?.data ?? listData?.tasks ?? listData?.items ?? [];
        const username = currentUser.username.trim().toLowerCase();
        setTasks(list.map(normalizeTask).filter((task) => String(task.ownerUsername).trim().toLowerCase() === username));
      }
      return true;
    } catch (error) {
      setApiError(`Nepavyko pridėti užduoties: ${error.message}`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(taskId, changes) {
    const currentTask = tasks.find((task) => String(task.id) === String(taskId));
    if (!currentTask) return;
    setApiError("");
    try {
      const response = await fetch(`${TASKS_API}/${encodeURIComponent(taskId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...currentTask,
          ...changes,
          Title: changes.title ?? currentTask.title,
          Status: changes.status ?? currentTask.status,
          Deadline: changes.deadline ?? currentTask.deadline,
        }),
      });
      const updated = await readResponse(response);
      setTasks((current) => current.map((task) =>
        String(task.id) === String(taskId) ? normalizeTask(updated || { ...task, ...changes }) : task,
      ));
    } catch (error) {
      setApiError(`Nepavyko atnaujinti užduoties. ${error.message}`);
      await loadTasks(currentUser);
    }
  }

  async function handleDeleteTask(taskId) {
    setApiError("");
    try {
      const response = await fetch(`${TASKS_API}/${encodeURIComponent(taskId)}`, { method: "DELETE" });
      await readResponse(response);
      setTasks((current) => current.filter((task) => String(task.id) !== String(taskId)));
    } catch (error) {
      setApiError(`Nepavyko ištrinti užduoties. ${error.message}`);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedTaskCount = tasks.filter((task) => task.status === "Atlikta").length;
  const overdueTaskCount = tasks.filter((task) => {
    if (task.status === "Atlikta" || !task.deadline) return false;
    return new Date(`${task.deadline}T00:00:00`) < today;
  }).length;

  return (
    <>
      <Navbar activePage={activePage} onNavigate={setActivePage} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      {activePage === "home" && <>
        {isLoggedIn && <header className="welcome-message"><h1>Sveiki sugrįžę!</h1><p>Prisijungėte kaip admin.</p></header>}
        <main className="login-page">
          {!isLoggedIn && <div className="login-card">
            <header className="login-card__header"><h1>{authMode === "login" ? "Prisijungti" : "Registruotis"}</h1><p>{authMode === "login" ? "Įveskite savo duomenis, kad tęstumėte" : "Sukurkite paskyrą šiame įrenginyje"}</p></header>
            {authMode === "login" ? <form className="login-form" onSubmit={handleSubmit}>
              <label className="login-field"><span>Vartotojo vardas</span><input type="text" name="username" autoComplete="username" placeholder="Įveskite vartotojo vardą" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <label className="login-field"><span>Slaptažodis</span><input type="password" name="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              <button type="submit" className="login-submit" disabled={usersLoading}>{usersLoading ? "Tikrinama..." : "Prisijungti"}</button>
              {loginError && <p className="login-error" role="status">{loginError}</p>}
              <p className="auth-switch">Neturite paskyros? <button type="button" onClick={() => { setAuthMode("register"); setLoginError(""); }}>Registruotis</button></p>
            </form> : <form className="login-form" onSubmit={handleRegister}>
              <label className="login-field"><span>Vartotojo vardas</span><input type="text" autoComplete="username" value={registerUsername} onChange={(event) => setRegisterUsername(event.target.value)} required /></label>
              <label className="login-field"><span>Slaptažodis</span><input type="password" autoComplete="new-password" minLength={4} value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} required /></label>
              {userError && <p className="login-error" role="alert">{userError}</p>}
              <p className="auth-note">Registracijos informacija bus išsaugota naudotojų duomenų bazėje.</p>
              <button type="submit" className="login-submit" disabled={accountSaving}>{accountSaving ? "Kuriama..." : "Sukurti paskyrą"}</button>
              <p className="auth-switch">Jau turite paskyrą? <button type="button" onClick={() => { setAuthMode("login"); setLoginError(""); }}>Prisijungti</button></p>
            </form>}
          </div>}
          {isLoggedIn && <>
            <section className="dashboard-summary" aria-label="Užduočių suvestinė"><p><strong>{tasks.length} užduotys</strong><span aria-hidden="true">·</span><strong>{completedTaskCount} atliktos</strong><span aria-hidden="true">·</span><strong>{overdueTaskCount} vėluoja</strong></p></section>
            {apiError && <p className="api-error" role="alert">{apiError}</p>}
            <TaskList tasks={tasks} loading={loading} onStatusChange={(id, status) => updateTask(id, { status })} onDeadlineChange={(id, deadline) => updateTask(id, { deadline })} onTitleChange={(id, title) => updateTask(id, { title })} onDelete={handleDeleteTask} />
            <AddTaskForm onAddTask={handleAddTask} saving={saving} error={apiError} />
            <WeatherWidget />
            <ProgressBar initialProgress={50} />
          </>}
        </main>
      </>}
      {activePage === "profile" && <Profile user={currentUser || { name: "Flowly naudotojas", email: "Nenurodytas" }} tasks={tasks} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} saving={accountSaving} error={userError} />}
    </>
  );
}

export default App;

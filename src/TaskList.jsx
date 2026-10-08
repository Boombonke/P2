import { useState } from "react";
import "./TaskList.css";

function TaskList({ tasks = [], loading = false, onStatusChange, onDeadlineChange, onTitleChange, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [editedTitle, setEditedTitle] = useState("");

  if (loading) return <section className="task-card"><p className="task-state">Kraunamos užduotys...</p></section>;
  if (tasks.length === 0) return <section className="task-card"><p className="task-state">Užduočių kol kas nėra.</p></section>;

  function saveTitle(task) {
    const title = editedTitle.trim();
    if (title && title !== task.title) onTitleChange?.(task.id, title);
    setEditingId(null);
  }

  return (
    <section className="task-card">
      <header className="task-card__header"><h2>Užduotys</h2><p>Artimiausi darbai ir jų būsena</p></header>
      <div className="task-list">
        {tasks.map((task) => <article className="task-item" key={task.id}>
          <div className="task-item__top">
            {editingId === task.id ? <form className="task-title-edit" onSubmit={(event) => { event.preventDefault(); saveTitle(task); }}>
              <input aria-label="Užduoties pavadinimas" value={editedTitle} onChange={(event) => setEditedTitle(event.target.value)} required autoFocus />
              <button type="submit">Išsaugoti</button>
              <button type="button" onClick={() => setEditingId(null)}>Atšaukti</button>
            </form> : <h3>{task.title}</h3>}
            <label className="task-status-field">
              <span className="visually-hidden">Užduoties statusas</span>
              <select className={`task-status task-status--${task.status.toLowerCase().replace(" ", "-")}`} value={task.status} onChange={(event) => onStatusChange?.(task.id, event.target.value)} aria-label={`Keisti užduoties „${task.title}“ statusą`}>
                <option value="Nepradėta">Nepradėta</option><option value="Vykdoma">Vykdoma</option><option value="Atlikta">Atlikta</option>
              </select>
            </label>
          </div>
          <label className="task-deadline"><span>Terminas:</span><input type="date" value={task.deadline} onChange={(event) => onDeadlineChange?.(task.id, event.target.value)} aria-label={`Keisti užduoties „${task.title}“ terminą`} /></label>
          <div className="task-actions">
            <button type="button" onClick={() => { setEditingId(task.id); setEditedTitle(task.title); }}>Redaguoti pavadinimą</button>
            <button type="button" className="task-delete" onClick={() => onDelete?.(task.id)}>Ištrinti</button>
          </div>
        </article>)}
      </div>
    </section>
  );
}

export default TaskList;

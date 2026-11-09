import React from "react";
import StatusBadge from "../../components/ui/StatusBadge";
import {getTaskProgress, getWorkCostSummary, getWorkMemberIdentity, getWorkPersonShort, groupWorkTasksByBoardColumn} from "../../domain/workModel.mjs";
import {formatMoney} from "../../utils/formatters.js";
import useBusinessFormat from "../../hooks/useBusinessFormat";

// Tablero de tareas del Proyecto abierto (SPEC 019 §5, compactado en SPEC 028
// etapa B2). Tres columnas (Por hacer, En curso, Hecho) sobre los cuatro estados
// de tarea de siempre: las tareas "en espera" van al final de "En curso" con su
// etiqueta y motivo. La tarjeta es solo un resumen (título, responsable,
// subtareas, costo asignado y espera); al hacer clic llama a `onOpenTask(task)`
// y el detalle y las acciones viven en WorkTaskPanel.
// Presentacional/controlado: recibe exclusivamente `tasks` ya acotadas al
// Proyecto actual (el arreglo visibleTasks que arma WorkProjectBoard). No define
// ninguna mutación propia, no hace ninguna consulta remota y no recibe ningún
// identificador de negocio ni de Proyecto: por construcción no puede leer ni
// mutar tareas de otro Proyecto. Sin drag-and-drop.

function responsableLabel(task) {
  return task.responsableUid ? getWorkMemberIdentity(task.responsableSnapshot || {}) : "";
}

function TaskCard({costs, currency, onOpenTask, task}) {
  const {locale: businessLocale} = useBusinessFormat();
  const progress = getTaskProgress(task);
  const taskCost = getWorkCostSummary({...costs, taskId: task.id});
  const identity = responsableLabel(task);
  const person = identity ? getWorkPersonShort(identity) : null;
  const waiting = task.estado === "en_espera";

  return (
    <button type="button" className="works-task-board__card" aria-haspopup="dialog" onClick={() => onOpenTask(task)}>
      <span className="works-task-card__title">{task.titulo}</span>
      <span className="works-task-card__person">
        {person
          ? <><span className="works-task-card__avatar" aria-hidden="true">{person.initials}</span><span className="works-task-card__name">{person.shortName}</span></>
          : <span className="works-task-card__none">Sin responsable</span>}
      </span>
      {progress.total > 0 && (
        <span className="works-task-card__progress">
          <span>Subtareas {progress.completed}/{progress.total}</span>
          <progress className="works-task-progress works-task-progress--thin" max="100" value={progress.percent} aria-label={`Avance de ${task.titulo}`} />
        </span>
      )}
      <span className="works-task-card__cost"><span>Costo asignado</span><span>{formatMoney(taskCost.total, currency, businessLocale)}</span></span>
      {waiting && (
        <span className="works-task-card__wait">
          <StatusBadge variant="warning">En espera</StatusBadge>
          {task.motivoEspera && <span className="works-task-card__wait-reason">{task.motivoEspera}</span>}
        </span>
      )}
    </button>
  );
}

export default function WorkTaskBoard({costs, currency, emptyCopy, onOpenTask, tasks}) {
  const list = Array.isArray(tasks) ? tasks : [];
  if (!list.length) return <p className="works-empty-copy">{emptyCopy}</p>;

  return (
    <div className="works-task-board">
      {groupWorkTasksByBoardColumn(list).map((column) => (
        <section className="works-task-board__column" key={column.id} aria-label={column.label}>
          <header><h4>{column.label}</h4><span>{column.tasks.length}</span></header>
          {column.tasks.length > 0
            ? <div className="works-task-board__list">{column.tasks.map((task) => <TaskCard costs={costs} currency={currency} key={task.id} onOpenTask={onOpenTask} task={task} />)}</div>
            : <p className="works-task-board__column-empty">Sin tareas</p>}
        </section>
      ))}
    </div>
  );
}

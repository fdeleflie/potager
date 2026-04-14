import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Task, Seedling } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Calendar, 
  Clock, 
  Sprout,
  ArrowRight,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';
import { format, differenceInDays, parseISO, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export function TasksView({ setCurrentView }: { setCurrentView: (v: string) => void }) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [showAutoTasks, setShowAutoTasks] = useState(true);

  const manualTasks = useLiveQuery(() => db.tasks.filter(t => !t.isDeleted).toArray());
  const seedlings = useLiveQuery(() => db.seedlings.filter(s => !s.isDeleted && !s.isArchived).toArray());

  // Logic to generate automatic tasks
  const autoTasks = useMemo(() => {
    if (!seedlings) return [];
    
    const generated: Task[] = [];
    const today = new Date();

    seedlings.forEach(s => {
      // 1. Suggest Transplanting (Repiquage) after 21 days of sowing
      if (s.state === 'Démarrage' && s.dateSown) {
        const daysSinceSown = differenceInDays(today, parseISO(s.dateSown));
        if (daysSinceSown >= 21) {
          generated.push({
            id: `auto-transplant-${s.id}`,
            title: `Repiquage suggéré : ${s.vegetable} (${s.variety})`,
            description: `Semé il y a ${daysSinceSown} jours. Il est probablement temps de repiquer ces plants.`,
            dateCreated: new Date().toISOString(),
            isCompleted: false,
            priority: daysSinceSown >= 28 ? 'high' : 'medium',
            type: 'automatic',
            seedlingId: s.id,
            isDeleted: false
          });
        }
      }

      // 2. Suggest Planting (Mise en terre) after 28 days of transplanting
      if (s.state === 'Repiquage' && s.dateTransplanted) {
        const daysSinceTransplanted = differenceInDays(today, parseISO(s.dateTransplanted));
        if (daysSinceTransplanted >= 28) {
          generated.push({
            id: `auto-plant-${s.id}`,
            title: `Mise en terre suggérée : ${s.vegetable} (${s.variety})`,
            description: `Repiqué il y a ${daysSinceTransplanted} jours. Ces plants devraient être prêts pour la mise en terre.`,
            dateCreated: new Date().toISOString(),
            isCompleted: false,
            priority: daysSinceTransplanted >= 35 ? 'high' : 'medium',
            type: 'automatic',
            seedlingId: s.id,
            isDeleted: false
          });
        }
      }
    });

    return generated;
  }, [seedlings]);

  const allTasks = useMemo(() => {
    const manual = manualTasks || [];
    const auto = showAutoTasks ? autoTasks : [];
    
    let combined = [...manual, ...auto];
    
    if (filter === 'pending') {
      combined = combined.filter(t => !t.isCompleted);
    } else if (filter === 'completed') {
      combined = combined.filter(t => t.isCompleted);
    }

    return combined.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      const priorityMap = { high: 0, medium: 1, low: 2 };
      if (priorityMap[a.priority] !== priorityMap[b.priority]) {
        return priorityMap[a.priority] - priorityMap[b.priority];
      }
      return new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime();
    });
  }, [manualTasks, autoTasks, filter, showAutoTasks]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: uuidv4(),
      title: newTaskTitle,
      dateCreated: new Date().toISOString(),
      isCompleted: false,
      priority: 'medium',
      type: 'manual',
      isDeleted: false
    };

    await db.tasks.add(newTask);
    setNewTaskTitle('');
  };

  const toggleTask = async (task: Task) => {
    if (task.type === 'automatic') {
      // For automatic tasks, we might want to navigate to the seedling detail or just ignore
      if (task.seedlingId) {
        setCurrentView(`seedling-detail-${task.seedlingId}`);
      }
      return;
    }
    await db.tasks.update(task.id, { 
      isCompleted: !task.isCompleted,
      dateCompleted: !task.isCompleted ? new Date().toISOString() : undefined
    });
  };

  const deleteTask = async (id: string) => {
    await db.tasks.update(id, { isDeleted: true });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-stone-200/60">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-medium text-stone-900">Gestionnaire de tâches</h1>
            <p className="text-xs text-stone-500">Organisez vos travaux au jardin</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-stone-100 p-1 rounded-lg">
            <button 
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filter === 'pending' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              À faire
            </button>
            <button 
              onClick={() => setFilter('completed')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filter === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Terminées
            </button>
            <button 
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filter === 'all' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Toutes
            </button>
          </div>
        </div>
      </header>

      {/* Add Task Form */}
      <form onSubmit={handleAddTask} className="flex gap-2">
        <input 
          type="text" 
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Ajouter une tâche manuelle..."
          className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        />
        <button 
          type="submit"
          disabled={!newTaskTitle.trim()}
          className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </form>

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowAutoTasks(!showAutoTasks)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
              showAutoTasks 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                : 'bg-stone-50 border-stone-200 text-stone-400'
            }`}
          >
            <Sprout className="w-3 h-3" />
            Suggestions auto : {showAutoTasks ? 'ON' : 'OFF'}
          </button>
        </div>
        <p className="text-[10px] text-stone-400 font-medium uppercase tracking-widest">
          {allTasks.length} tâche{allTasks.length > 1 ? 's' : ''}
        </p>
      </div>

      {allTasks.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-stone-200/60 shadow-sm text-center">
          <div className="w-16 h-16 bg-stone-50 text-stone-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckSquare className="w-8 h-8" />
          </div>
          <h3 className="text-stone-900 font-medium">Aucune tâche pour le moment</h3>
          <p className="text-stone-500 text-sm mt-1">Profitez de votre jardin !</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allTasks.map(task => (
            <div 
              key={task.id}
              className={`group bg-white p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                task.isCompleted 
                  ? 'border-stone-100 opacity-60' 
                  : task.type === 'automatic' 
                    ? 'border-emerald-100 bg-emerald-50/10' 
                    : 'border-stone-200 shadow-sm hover:border-emerald-200'
              }`}
            >
              <button 
                onClick={() => toggleTask(task)}
                className={`mt-0.5 transition-colors ${
                  task.isCompleted 
                    ? 'text-emerald-500' 
                    : task.type === 'automatic'
                      ? 'text-emerald-400 hover:text-emerald-600'
                      : 'text-stone-300 hover:text-emerald-500'
                }`}
              >
                {task.isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : task.type === 'automatic' ? (
                  <Sprout className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className={`text-sm font-medium truncate ${task.isCompleted ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
                    {task.title}
                  </h3>
                  {task.priority === 'high' && !task.isCompleted && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold uppercase rounded">Urgent</span>
                  )}
                  {task.type === 'automatic' && (
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase rounded">Auto</span>
                  )}
                </div>
                {task.description && (
                  <p className={`text-xs ${task.isCompleted ? 'text-stone-400' : 'text-stone-500'}`}>
                    {task.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1 text-[10px] text-stone-400 font-medium">
                    <Clock className="w-3 h-3" />
                    {format(parseISO(task.dateCreated), 'dd MMM yyyy', { locale: fr })}
                  </div>
                  {task.type === 'automatic' && task.seedlingId && (
                    <button 
                      onClick={() => setCurrentView(`seedling-detail-${task.seedlingId}`)}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                    >
                      Voir la fiche
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {task.type === 'manual' && (
                <button 
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

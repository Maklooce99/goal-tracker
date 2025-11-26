import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getToday = () => getDateString(new Date());

const getWeekDates = (offset = 0) => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  
  const dayOfWeek = today.getDay();
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - (adjustedDay - 1) + (offset * 7));
  
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dates.push(getDateString(date));
  }
  return dates;
};

const formatDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatWeekRange = (dates) => {
  if (!dates || dates.length < 7) return '';
  const [startYear, startMonth, startDay] = dates[0].split('-').map(Number);
  const [endYear, endMonth, endDay] = dates[6].split('-').map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startStr} — ${endStr}`;
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let idCounter = 0;
const generateId = () => `goal_${Date.now()}_${++idCounter}`;

const STORAGE_KEYS = {
  GOALS: 'goaltracker_goals',
  ENTRIES: 'goaltracker_entries'
};

// ============================================
// CUSTOM HOOKS
// ============================================

const useDataStore = () => {
  const [goals, setGoals] = useState([]);
  const [entries, setEntries] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedGoals = localStorage.getItem(STORAGE_KEYS.GOALS);
      const savedEntries = localStorage.getItem(STORAGE_KEYS.ENTRIES);
      if (savedGoals) setGoals(JSON.parse(savedGoals));
      if (savedEntries) setEntries(JSON.parse(savedEntries));
    } catch (err) {
      console.error('Error loading from localStorage:', err);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
      } catch (err) {
        console.error('Error saving goals:', err);
      }
    }
  }, [goals, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
      } catch (err) {
        console.error('Error saving entries:', err);
      }
    }
  }, [entries, isLoaded]);

  const addGoal = useCallback((name, weeklyTarget) => {
    if (!name?.trim() || weeklyTarget < 1 || weeklyTarget > 7) return null;
    const newGoal = {
      id: generateId(),
      name: name.trim(),
      weekly_target: Math.min(7, Math.max(1, weeklyTarget)),
      created_at: new Date().toISOString()
    };
    setGoals(prev => [newGoal, ...prev]);
    return newGoal;
  }, []);

  const updateGoal = useCallback((id, updates) => {
    if (!id) return;
    setGoals(prev => prev.map(g => {
      if (g.id !== id) return g;
      return {
        ...g,
        name: updates.name?.trim() || g.name,
        weekly_target: updates.weekly_target ? Math.min(7, Math.max(1, updates.weekly_target)) : g.weekly_target
      };
    }));
  }, []);

  const deleteGoal = useCallback((id) => {
    if (!id) return;
    setGoals(prev => prev.filter(g => g.id !== id));
    setEntries(prev => {
      const updated = {};
      Object.keys(prev).forEach(key => {
        if (!key.startsWith(id + '-')) updated[key] = prev[key];
      });
      return updated;
    });
  }, []);

  const toggleEntry = useCallback((goalId, date) => {
    if (!goalId || !date) return;
    const key = `${goalId}-${date}`;
    setEntries(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const getEntriesForWeek = useCallback((weekDates) => {
    if (!weekDates?.length) return [];
    return goals.map(goal => ({
      goal,
      entries: weekDates.map(date => ({
        date,
        achieved: Boolean(entries[`${goal.id}-${date}`])
      }))
    }));
  }, [goals, entries]);

  const getWeeklyStats = useCallback((goalId, numWeeks = 8) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return [];
    const stats = [];
    for (let i = numWeeks - 1; i >= 0; i--) {
      const weekDates = getWeekDates(-i);
      const achieved = weekDates.filter(date => entries[`${goalId}-${date}`]).length;
      stats.push({ week_start: weekDates[0], achieved, target: goal.weekly_target });
    }
    return stats;
  }, [goals, entries]);

  return { goals, addGoal, updateGoal, deleteGoal, toggleEntry, getEntriesForWeek, getWeeklyStats, entries, isLoaded };
};

// ============================================
// COMPONENTS
// ============================================

const GoalForm = memo(function GoalForm({ onSubmit, onCancel, initialData }) {
  const [name, setName] = useState(initialData?.name || '');
  const [target, setTarget] = useState(initialData?.weekly_target || 7);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(() => {
    setError('');
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a goal name');
      return;
    }
    onSubmit({ name: trimmedName, weekly_target: target });
    if (!initialData) {
      setName('');
      setTarget(7);
    }
  }, [name, target, onSubmit, initialData]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div style={styles.form}>
      <div style={styles.formGroup}>
        <label style={styles.label}>Goal</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., Exercise for 30 minutes"
          style={styles.input}
          autoFocus
          maxLength={100}
        />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>Weekly target (days)</label>
        <input
          type="number"
          min="1"
          max="7"
          value={target}
          onChange={(e) => setTarget(Math.min(7, Math.max(1, parseInt(e.target.value) || 1)))}
          onKeyDown={handleKeyDown}
          style={{ ...styles.input, width: '80px' }}
        />
      </div>
      {error && <p style={styles.errorText}>{error}</p>}
      <div style={styles.formActions}>
        <button type="button" onClick={handleSubmit} style={styles.primaryButton}>
          {initialData ? 'Update' : 'Add Goal'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} style={styles.secondaryButton}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
});

const DayCell = memo(function DayCell({ date, achieved, onToggle, isToday, isPast }) {
  const [year, month, day] = date.split('-').map(Number);
  const jsDay = new Date(year, month - 1, day).getDay();
  const dayIndex = jsDay === 0 ? 6 : jsDay - 1;

  const cellStyle = useMemo(() => ({
    ...styles.dayCell,
    ...(achieved ? styles.dayCellAchieved : {}),
    ...(isToday ? styles.dayCellToday : {}),
    ...(!isPast && !isToday ? styles.dayCellFuture : {}),
  }), [achieved, isToday, isPast]);

  return (
    <button onClick={onToggle} style={cellStyle} title={formatDate(date)}>
      <span style={styles.dayName}>{DAY_NAMES[dayIndex]}</span>
      <span style={styles.dayIcon}>{achieved ? '✓' : '—'}</span>
    </button>
  );
});

const GoalCard = memo(function GoalCard({ goal, dayEntries, weekDates, onToggleDay, onDelete, onEdit }) {
  const today = getToday();

  const { achievedCount, progress, isComplete } = useMemo(() => {
    const achieved = dayEntries.filter(e => e.achieved).length;
    const prog = Math.round((achieved / goal.weekly_target) * 100);
    return { achievedCount: achieved, progress: prog, isComplete: achieved >= goal.weekly_target };
  }, [dayEntries, goal.weekly_target]);

  const handleDelete = useCallback(() => {
    if (window.confirm('Delete this goal and all its data?')) {
      onDelete(goal.id);
    }
  }, [goal.id, onDelete]);

  return (
    <div style={styles.goalCard}>
      <div style={styles.goalHeader}>
        <div style={styles.goalInfo}>
          <h3 style={styles.goalName}>{goal.name}</h3>
          <span style={{ ...styles.goalProgress, color: isComplete ? '#16a34a' : '#78716c' }}>
            {achievedCount}/{goal.weekly_target} days · {progress}%
          </span>
        </div>
        <div style={styles.goalActions}>
          <button onClick={() => onEdit(goal)} style={styles.iconButton} title="Edit">✎</button>
          <button onClick={handleDelete} style={styles.iconButton} title="Delete">×</button>
        </div>
      </div>

      <div style={styles.progressBar}>
        <div style={{
          ...styles.progressFill,
          width: `${Math.min(progress, 100)}%`,
          backgroundColor: isComplete ? '#16a34a' : '#a8a29e'
        }} />
      </div>

      <div style={styles.daysGrid}>
        {weekDates.map((date, idx) => {
          const entry = dayEntries[idx];
          const isPast = date < today;
          const isToday = date === today;
          return (
            <DayCell
              key={date}
              date={date}
              achieved={entry?.achieved}
              onToggle={() => onToggleDay(goal.id, date)}
              isToday={isToday}
              isPast={isPast}
            />
          );
        })}
      </div>
    </div>
  );
});

const WeeklyStats = memo(function WeeklyStats({ goals, getWeeklyStats }) {
  if (goals.length === 0) return null;

  return (
    <div style={styles.statsSection}>
      <h2 style={styles.sectionTitle}>Progress History</h2>
      {goals.map(goal => {
        const stats = getWeeklyStats(goal.id, 8);
        return (
          <div key={goal.id} style={styles.statsCard}>
            <h4 style={styles.statsGoalName}>{goal.name}</h4>
            <div style={styles.weekGrid}>
              {stats.map((week) => {
                const percentage = Math.round((week.achieved / week.target) * 100);
                const isComplete = week.achieved >= week.target;
                const [year, month, day] = week.week_start.split('-').map(Number);
                const weekDate = new Date(year, month - 1, day);
                return (
                  <div key={week.week_start} style={styles.weekColumn}>
                    <div style={{
                      ...styles.weekBar,
                      height: `${Math.max(percentage, 5)}%`,
                      backgroundColor: isComplete ? '#16a34a' : '#e7e5e4',
                    }} title={`${week.achieved}/${week.target} days`} />
                    <span style={styles.weekLabel}>
                      {weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});

const PerformanceByWeek = memo(function PerformanceByWeek({ goals, entries }) {
  const numWeeks = 12;

  const weekStarts = useMemo(() => {
    const weeks = [];
    for (let i = 0; i < numWeeks; i++) {
      const weekDates = getWeekDates(i);
      weeks.push(weekDates[0]);
    }
    return weeks;
  }, []);

  const performanceData = useMemo(() => {
    return goals.map(goal => {
      const weeklyPerformance = weekStarts.map((weekStart, idx) => {
        const weekDates = getWeekDates(idx);
        const achieved = weekDates.filter(date => entries[`${goal.id}-${date}`]).length;
        return {
          weekStart,
          percentage: Math.round((achieved / goal.weekly_target) * 100),
          achieved,
          target: goal.weekly_target
        };
      });
      return { goal, weeklyPerformance };
    });
  }, [goals, weekStarts, entries]);

  const weeklyAverages = useMemo(() => {
    if (goals.length === 0) return [];
    return weekStarts.map((_, weekIndex) => {
      const percentages = performanceData.map(pd => pd.weeklyPerformance[weekIndex]?.percentage || 0);
      const avg = percentages.reduce((a, b) => a + b, 0) / percentages.length;
      return Math.round(avg);
    });
  }, [weekStarts, performanceData, goals.length]);

  if (goals.length === 0) {
    return (
      <div style={styles.emptyState}>
        <p>No goals yet.</p>
        <p style={{ color: '#78716c', fontSize: '14px', marginTop: '8px' }}>Add goals to see performance data.</p>
      </div>
    );
  }

  const getColorForPercentage = (pct) => {
    if (pct >= 100) return { bg: '#dcfce7', text: '#16a34a' };
    if (pct >= 75) return { bg: '#fef9c3', text: '#a16207' };
    if (pct >= 50) return { bg: '#fed7aa', text: '#c2410c' };
    return { bg: '#fecaca', text: '#dc2626' };
  };

  return (
    <div style={styles.performanceContainer}>
      <div style={styles.tableWrapper}>
        <table style={styles.performanceTable}>
          <thead>
            <tr>
              <th style={styles.tableHeaderCell}>Goal</th>
              {weekStarts.map(weekStart => {
                const [year, month, day] = weekStart.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                return (
                  <th key={weekStart} style={styles.tableHeaderCellWeek}>
                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {performanceData.map(({ goal, weeklyPerformance }) => (
              <tr key={goal.id}>
                <td style={styles.tableGoalCell}>{goal.name}</td>
                {weeklyPerformance.map((perf, idx) => {
                  const colors = getColorForPercentage(perf.percentage);
                  return (
                    <td key={weekStarts[idx]} style={{
                      ...styles.tableDataCell,
                      backgroundColor: colors.bg,
                      color: colors.text
                    }} title={`${perf.achieved}/${perf.target} days`}>
                      {perf.percentage}%
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr style={styles.averageRow}>
              <td style={styles.tableGoalCell}><strong>Average</strong></td>
              {weeklyAverages.map((avg, idx) => {
                const colors = getColorForPercentage(avg);
                return (
                  <td key={weekStarts[idx]} style={{
                    ...styles.tableDataCell,
                    backgroundColor: colors.bg,
                    color: colors.text,
                    fontWeight: '600'
                  }}>
                    {avg}%
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <div style={styles.legendContainer}>
        <span style={styles.legendTitle}>Legend:</span>
        <span style={{ ...styles.legendItem, backgroundColor: '#dcfce7', color: '#16a34a' }}>100%+</span>
        <span style={{ ...styles.legendItem, backgroundColor: '#fef9c3', color: '#a16207' }}>75-99%</span>
        <span style={{ ...styles.legendItem, backgroundColor: '#fed7aa', color: '#c2410c' }}>50-74%</span>
        <span style={{ ...styles.legendItem, backgroundColor: '#fecaca', color: '#dc2626' }}>&lt;50%</span>
      </div>
    </div>
  );
});

// ============================================
// MAIN APP
// ============================================

function GoalTrackerApp() {
  const { goals, addGoal, updateGoal, deleteGoal, toggleEntry, getEntriesForWeek, getWeeklyStats, entries, isLoaded } = useDataStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [activeTab, setActiveTab] = useState('tracker');

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekData = useMemo(() => getEntriesForWeek(weekDates), [getEntriesForWeek, weekDates]);
  const isCurrentWeek = weekOffset === 0;
  const weekRangeText = useMemo(() => formatWeekRange(weekDates), [weekDates]);

  const handleAddGoal = useCallback((goalData) => {
    addGoal(goalData.name, goalData.weekly_target);
    setShowForm(false);
  }, [addGoal]);

  const handleUpdateGoal = useCallback((goalData) => {
    if (editingGoal) {
      updateGoal(editingGoal.id, goalData);
      setEditingGoal(null);
    }
  }, [editingGoal, updateGoal]);

  if (!isLoaded) {
    return <div style={{ ...styles.container, justifyContent: 'center', alignItems: 'center' }}><p>Loading...</p></div>;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Goals</h1>
        <p style={styles.subtitle}>Track your weekly progress</p>
      </header>

      <div style={styles.tabContainer}>
        <button
          onClick={() => setActiveTab('tracker')}
          style={{ ...styles.tabButton, ...(activeTab === 'tracker' ? styles.tabButtonActive : {}) }}
        >
          Weekly Tracker
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          style={{ ...styles.tabButton, ...(activeTab === 'performance' ? styles.tabButtonActive : {}) }}
        >
          Performance by Week
        </button>
      </div>

      <main style={styles.main}>
        {activeTab === 'tracker' ? (
          <>
            <nav style={styles.weekNav}>
              <button onClick={() => setWeekOffset(o => o - 1)} style={styles.navButton}>← Prev</button>
              <span style={styles.weekRange}>
                {weekRangeText}
                {isCurrentWeek && <span style={styles.currentBadge}>This week</span>}
              </span>
              <button onClick={() => setWeekOffset(o => o + 1)} style={styles.navButton} disabled={weekOffset >= 0}>Next →</button>
            </nav>

            {!showForm && !editingGoal && (
              <button onClick={() => setShowForm(true)} style={styles.addButton}>+ New Goal</button>
            )}

            {showForm && (
              <div style={styles.formCard}>
                <h2 style={styles.formTitle}>New Goal</h2>
                <GoalForm onSubmit={handleAddGoal} onCancel={() => setShowForm(false)} />
              </div>
            )}

            {editingGoal && (
              <div style={styles.formCard}>
                <h2 style={styles.formTitle}>Edit Goal</h2>
                <GoalForm initialData={editingGoal} onSubmit={handleUpdateGoal} onCancel={() => setEditingGoal(null)} />
              </div>
            )}

            {goals.length === 0 ? (
              <div style={styles.emptyState}>
                <p>No goals yet.</p>
                <p style={{ color: '#78716c', fontSize: '14px', marginTop: '8px' }}>Add your first weekly goal to get started.</p>
              </div>
            ) : (
              <div style={styles.goalsList}>
                {weekData.map(({ goal, entries }) => (
                  <div key={goal.id} className="goal-card">
                    <GoalCard
                      goal={goal}
                      dayEntries={entries}
                      weekDates={weekDates}
                      onToggleDay={toggleEntry}
                      onDelete={deleteGoal}
                      onEdit={setEditingGoal}
                    />
                  </div>
                ))}
              </div>
            )}

            <WeeklyStats goals={goals} getWeeklyStats={getWeeklyStats} />
          </>
        ) : (
          <PerformanceByWeek goals={goals} entries={entries} />
        )}
      </main>

      <footer style={styles.footer}>
        <p>Stay consistent. Small steps lead to big changes.</p>
      </footer>
    </div>
  );
}

export default function App() {
  return <GoalTrackerApp />;
}

// ============================================
// STYLES
// ============================================

const styles = {
  container: { maxWidth: '680px', margin: '0 auto', padding: '40px 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'DM Mono', monospace" },
  header: { marginBottom: '48px', textAlign: 'center' },
  title: { fontSize: '48px', fontFamily: "'Instrument Serif', serif", marginBottom: '8px', letterSpacing: '-0.02em', fontWeight: '400' },
  subtitle: { color: '#78716c', fontSize: '14px' },
  main: { flex: 1 },
  weekNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', padding: '16px 0', borderBottom: '1px solid #e7e5e4' },
  navButton: { background: 'none', border: 'none', color: '#78716c', fontSize: '14px', padding: '8px 12px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" },
  weekRange: { fontSize: '16px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '12px' },
  currentBadge: { fontSize: '11px', background: '#dcfce7', color: '#16a34a', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  addButton: { width: '100%', padding: '16px', background: 'none', border: '2px dashed #e7e5e4', borderRadius: '12px', color: '#78716c', fontSize: '14px', marginBottom: '24px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" },
  formCard: { background: '#ffffff', border: '1px solid #e7e5e4', borderRadius: '12px', padding: '24px', marginBottom: '24px' },
  formTitle: { fontFamily: "'Instrument Serif', serif", fontSize: '24px', marginBottom: '16px', fontWeight: '400' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { padding: '12px', border: '1px solid #e7e5e4', borderRadius: '8px', fontSize: '16px', background: '#fafaf9', outline: 'none', fontFamily: "'DM Mono', monospace" },
  errorText: { color: '#dc2626', fontSize: '13px', marginTop: '-8px' },
  formActions: { display: 'flex', gap: '12px', marginTop: '8px' },
  primaryButton: { padding: '12px 24px', background: '#1c1917', color: '#fafaf9', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: "'DM Mono', monospace" },
  secondaryButton: { padding: '12px 24px', background: 'none', color: '#78716c', border: '1px solid #e7e5e4', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" },
  goalsList: { display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '48px' },
  goalCard: { background: '#ffffff', border: '1px solid #e7e5e4', borderRadius: '12px', padding: '20px' },
  goalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  goalInfo: { flex: 1 },
  goalName: { fontSize: '20px', fontFamily: "'Instrument Serif', serif", marginBottom: '4px', fontWeight: '400' },
  goalProgress: { fontSize: '13px' },
  goalActions: { display: 'flex', gap: '4px' },
  iconButton: { background: 'none', border: 'none', color: '#78716c', fontSize: '18px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' },
  progressBar: { height: '4px', background: '#e7e5e4', borderRadius: '2px', marginBottom: '16px', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: '2px', transition: 'width 0.3s ease' },
  daysGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' },
  dayCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 8px', border: '1px solid #e7e5e4', borderRadius: '8px', background: '#fafaf9', cursor: 'pointer', fontFamily: "'DM Mono', monospace", transition: 'all 0.15s ease' },
  dayCellAchieved: { background: '#dcfce7', borderColor: '#16a34a', color: '#16a34a' },
  dayCellToday: { borderColor: '#1c1917', borderWidth: '2px' },
  dayCellFuture: { opacity: 0.5 },
  dayName: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' },
  dayIcon: { fontSize: '16px', fontWeight: '500' },
  emptyState: { textAlign: 'center', padding: '48px 24px', color: '#1c1917' },
  statsSection: { marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e7e5e4' },
  sectionTitle: { fontSize: '28px', fontFamily: "'Instrument Serif', serif", marginBottom: '20px', fontWeight: '400' },
  statsCard: { background: '#ffffff', border: '1px solid #e7e5e4', borderRadius: '12px', padding: '20px', marginBottom: '16px' },
  statsGoalName: { fontSize: '14px', color: '#78716c', marginBottom: '16px', fontWeight: '500' },
  weekGrid: { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '8px', height: '80px', alignItems: 'flex-end' },
  weekColumn: { display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  weekBar: { width: '100%', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease', minHeight: '4px' },
  weekLabel: { fontSize: '9px', color: '#78716c', marginTop: '6px', textAlign: 'center' },
  tabContainer: { display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e7e5e4', paddingBottom: '0' },
  tabButton: { padding: '12px 20px', background: 'none', border: 'none', borderBottom: '2px solid transparent', color: '#78716c', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", marginBottom: '-1px', transition: 'all 0.15s ease' },
  tabButtonActive: { color: '#1c1917', borderBottomColor: '#1c1917', fontWeight: '500' },
  performanceContainer: { marginTop: '8px' },
  tableWrapper: { overflowX: 'auto', border: '1px solid #e7e5e4', borderRadius: '12px', background: '#ffffff' },
  performanceTable: { width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Mono', monospace", fontSize: '13px', minWidth: '700px' },
  tableHeaderCell: { textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid #e7e5e4', fontWeight: '500', color: '#78716c', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', left: 0, background: '#ffffff', minWidth: '140px' },
  tableHeaderCellWeek: { textAlign: 'center', padding: '14px 8px', borderBottom: '1px solid #e7e5e4', fontWeight: '500', color: '#78716c', fontSize: '11px', minWidth: '65px' },
  tableGoalCell: { padding: '12px 16px', borderBottom: '1px solid #f5f5f4', fontWeight: '400', color: '#1c1917', position: 'sticky', left: 0, background: '#ffffff', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tableDataCell: { textAlign: 'center', padding: '10px 8px', borderBottom: '1px solid #f5f5f4', fontWeight: '500', fontSize: '12px', transition: 'all 0.15s ease' },
  averageRow: { borderTop: '2px solid #e7e5e4' },
  legendContainer: { display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', flexWrap: 'wrap' },
  legendTitle: { fontSize: '12px', color: '#78716c', fontWeight: '500' },
  legendItem: { fontSize: '11px', padding: '4px 10px', borderRadius: '4px', fontWeight: '500' },
  footer: { marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #e7e5e4', textAlign: 'center', color: '#78716c', fontSize: '13px', fontStyle: 'italic' },
};

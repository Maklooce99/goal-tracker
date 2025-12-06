import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ============================================
// SUPABASE CLIENT
// ============================================

const supabase = createClient(
  'https://evapuqvlxouaoaazcmxb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2YXB1cXZseG91YW9hYXpjbXhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4ODgwNTIsImV4cCI6MjA4MDQ2NDA1Mn0.sj3ALmlDb_tzzNoKRh1iddR05pLgimnFqkmjk2dX-aU'
);

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

const getWeekStart = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  const dayOfWeek = date.getDay();
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
  date.setDate(date.getDate() - (adjustedDay - 1));
  return getDateString(date);
};

const formatShortDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatDayDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${month}/${day}`;
};

const daysBetween = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2 - d1;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const weeksBetween = (date1, date2) => {
  return Math.floor(daysBetween(date1, date2) / 7);
};

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ============================================
// DATA HOOK WITH SUPABASE
// ============================================

const useGoals = () => {
  const [goals, setGoals] = useState([]);
  const [entries, setEntries] = useState({});
  const [milestones, setMilestones] = useState([]);
  const [settings, setSettings] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: goalsData, error: goalsError } = await supabase
          .from('goals')
          .select('*')
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true });
        
        if (goalsError) throw goalsError;
        
        const { data: entriesData, error: entriesError } = await supabase
          .from('entries')
          .select('*');
        
        if (entriesError) throw entriesError;
        
        const { data: milestonesData, error: milestonesError } = await supabase
          .from('milestone')
          .select('*')
          .order('target_date', { ascending: true });
        
        if (milestonesError) {
          console.error('Milestones error:', milestonesError);
        }

        const { data: settingsData, error: settingsError } = await supabase
          .from('settings')
          .select('*');
        
        if (settingsError) {
          console.error('Settings error:', settingsError);
        }
        
        const entriesMap = {};
        entriesData?.forEach(entry => {
          entriesMap[`${entry.goal_id}-${entry.date}`] = entry.achieved;
        });

        const settingsMap = {};
        settingsData?.forEach(s => {
          settingsMap[s.key] = s.value;
        });
        
        setGoals(goalsData || []);
        setEntries(entriesMap);
        setMilestones(milestonesData || []);
        setSettings(settingsMap);
      } catch (err) {
        console.error('Error loading data:', err);
      }
      setIsLoaded(true);
    };

    loadData();
  }, []);

  const addGoal = useCallback(async (name, target = 7) => {
    if (!name?.trim()) return;
    
    const maxOrder = goals.reduce((max, g) => Math.max(max, g.sort_order || 0), 0);
    
    const newGoal = {
      name: name.trim(),
      target: Math.min(7, Math.max(1, target)),
      sort_order: maxOrder + 1
    };
    
    try {
      const { data, error } = await supabase
        .from('goals')
        .insert(newGoal)
        .select()
        .single();
      
      if (error) throw error;
      setGoals(prev => [...prev, data]);
    } catch (err) {
      console.error('Error adding goal:', err);
    }
  }, [goals]);

  const deleteGoal = useCallback(async (id) => {
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setGoals(prev => prev.filter(g => g.id !== id));
      setEntries(prev => {
        const updated = {};
        Object.keys(prev).forEach(key => {
          if (!key.startsWith(id + '-')) updated[key] = prev[key];
        });
        return updated;
      });
    } catch (err) {
      console.error('Error deleting goal:', err);
    }
  }, []);

  const reorderGoals = useCallback(async (newGoals) => {
    setGoals(newGoals);
    
    try {
      const updates = newGoals.map((goal, index) => ({
        id: goal.id,
        name: goal.name,
        target: goal.target,
        sort_order: index,
        created_at: goal.created_at
      }));
      
      const { error } = await supabase
        .from('goals')
        .upsert(updates);
      
      if (error) throw error;
    } catch (err) {
      console.error('Error reordering goals:', err);
    }
  }, []);

  const toggleEntry = useCallback(async (goalId, date) => {
    const key = `${goalId}-${date}`;
    const currentValue = entries[key];
    
    setEntries(prev => ({ ...prev, [key]: !currentValue }));
    
    try {
      if (currentValue) {
        const { error } = await supabase
          .from('entries')
          .delete()
          .eq('goal_id', goalId)
          .eq('date', date);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('entries')
          .insert({ goal_id: goalId, date, achieved: true });
        
        if (error) throw error;
      }
    } catch (err) {
      console.error('Error toggling entry:', err);
      setEntries(prev => ({ ...prev, [key]: currentValue }));
    }
  }, [entries]);

  const saveMilestone = useCallback(async (milestoneData, existingId = null) => {
    try {
      if (existingId) {
        const { data, error } = await supabase
          .from('milestone')
          .update(milestoneData)
          .eq('id', existingId)
          .select()
          .single();
        
        if (error) throw error;
        setMilestones(prev => prev.map(m => m.id === existingId ? data : m));
      } else {
        const { data, error } = await supabase
          .from('milestone')
          .insert(milestoneData)
          .select()
          .single();
        
        if (error) throw error;
        setMilestones(prev => [...prev, data].sort((a, b) => 
          new Date(a.target_date) - new Date(b.target_date)
        ));
      }
    } catch (err) {
      console.error('Error saving milestone:', err);
    }
  }, []);

  const deleteMilestone = useCallback(async (id) => {
    if (!id) return;
    
    try {
      const { error } = await supabase
        .from('milestone')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setMilestones(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('Error deleting milestone:', err);
    }
  }, []);

  const saveSetting = useCallback(async (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      
      if (error) throw error;
    } catch (err) {
      console.error('Error saving setting:', err);
    }
  }, []);

  return { 
    goals, entries, milestones, settings, isLoaded, 
    addGoal, deleteGoal, toggleEntry, reorderGoals,
    saveMilestone, deleteMilestone, saveSetting
  };
};

// ============================================
// SORTABLE ROW COMPONENT
// ============================================

function SortableRow({ goal, weekDates, today, entries, toggleEntry, deleteGoal }) {
  const [isHovered, setIsHovered] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const achieved = weekDates.filter(d => entries[`${goal.id}-${d}`]).length;
  const target = goal.target || 7;
  const pct = Math.round((achieved / target) * 100);

  return (
    <tr 
      ref={setNodeRef} 
      style={style} 
      {...attributes}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <td style={styles.tdGoal}>
        <span 
          {...listeners} 
          style={{
            ...styles.dragHandle,
            opacity: isHovered ? 1 : 0
          }}
        >
          ⋮⋮
        </span>
        <span style={styles.goalText}>{goal.name}</span>
        <button 
          onClick={() => deleteGoal(goal.id)} 
          style={{
            ...styles.deleteBtn,
            opacity: isHovered ? 1 : 0
          }}
        >
          ×
        </button>
      </td>
      {weekDates.map((date) => {
        const isChecked = entries[`${goal.id}-${date}`];
        const isToday = date === today;
        return (
          <td key={date} style={{
            ...styles.tdDay,
            background: isToday ? '#f9f9f9' : 'transparent',
          }}>
            <div
              onClick={() => toggleEntry(goal.id, date)}
              style={{
                ...styles.checkbox,
                background: isChecked ? '#222' : '#f5f5f5',
                border: `1px solid ${isChecked ? '#222' : '#ddd'}`,
              }}
            >
              {isChecked && <span style={styles.check}>✓</span>}
            </div>
          </td>
        );
      })}
      <td style={{
        ...styles.tdPct,
        color: pct >= 100 ? '#22c55e' : '#999'
      }}>
        {pct}%
      </td>
    </tr>
  );
}

// ============================================
// MILESTONE BADGE COMPONENT
// ============================================

function MilestoneBadge({ milestone, goals, entries, onEdit }) {
  const today = getToday();
  
  const { daysRemaining, overallPct } = useMemo(() => {
    if (!milestone) return { daysRemaining: 0, overallPct: 0 };
    
    const days = daysBetween(today, milestone.target_date);
    
    const startWeek = getWeekStart(milestone.start_date);
    const currentWeek = getWeekStart(today);
    
    const weeksCount = Math.max(1, Math.floor(daysBetween(startWeek, currentWeek) / 7) + 1);
    
    let totalExpected = 0;
    let totalAchieved = 0;
    
    goals.forEach(goal => {
      const target = goal.target || 7;
      totalExpected += target * weeksCount;
      
      let currentDate = new Date(milestone.start_date);
      const endDate = new Date(today);
      
      while (currentDate <= endDate) {
        const dateStr = getDateString(currentDate);
        if (entries[`${goal.id}-${dateStr}`]) {
          totalAchieved++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    const pct = totalExpected > 0 ? Math.round((totalAchieved / totalExpected) * 100) : 0;
    
    return { daysRemaining: days, overallPct: pct };
  }, [milestone, goals, entries, today]);

  return (
    <button onClick={() => onEdit(milestone)} style={styles.milestoneBadge}>
      <span style={styles.milestoneName}>{milestone.name}</span>
      <span style={styles.milestoneDays}>{daysRemaining}d</span>
      <span style={styles.milestoneDivider}>|</span>
      <span style={{
        ...styles.milestonePct,
        color: overallPct >= 80 ? '#22c55e' : overallPct >= 50 ? '#eab308' : '#999'
      }}>{overallPct}%</span>
    </button>
  );
}

// ============================================
// MILESTONES BAR COMPONENT
// ============================================

function MilestonesBar({ milestones, goals, entries, onEdit, onAdd }) {
  return (
    <div style={styles.milestonesBar}>
      {milestones.map(milestone => (
        <MilestoneBadge
          key={milestone.id}
          milestone={milestone}
          goals={goals}
          entries={entries}
          onEdit={onEdit}
        />
      ))}
      <button onClick={onAdd} style={styles.addMilestoneBtn}>
        + Milestone
      </button>
    </div>
  );
}

// ============================================
// MILESTONE EDITOR MODAL
// ============================================

function MilestoneEditor({ milestone, onSave, onDelete, onClose }) {
  const [name, setName] = useState(milestone?.name || '');
  const [startDate, setStartDate] = useState(milestone?.start_date || getToday());
  const [targetDate, setTargetDate] = useState(milestone?.target_date || '');

  const handleSave = () => {
    if (!name.trim() || !targetDate) return;
    onSave({
      name: name.trim(),
      start_date: startDate,
      target_date: targetDate
    }, milestone?.id);
    onClose();
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>
          {milestone ? 'Edit Milestone' : 'Add Milestone'}
        </h3>
        
        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Bike Race"
            style={styles.modalInput}
            autoFocus
          />
        </div>
        
        <div style={styles.modalRow}>
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={styles.modalInput}
            />
          </div>
          
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Target Date</label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              style={styles.modalInput}
            />
          </div>
        </div>
        
        <div style={styles.modalActions}>
          {milestone && (
            <button onClick={() => { onDelete(milestone.id); onClose(); }} style={styles.modalDeleteBtn}>
              Delete
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={styles.modalCancelBtn}>Cancel</button>
          <button onClick={handleSave} style={styles.modalSaveBtn}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SETTINGS MODAL
// ============================================

function SettingsModal({ settings, onSave, onClose }) {
  const [trackingStartDate, setTrackingStartDate] = useState(
    settings.tracking_start_date || getToday()
  );

  const handleSave = () => {
    onSave('tracking_start_date', trackingStartDate);
    onClose();
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>Settings</h3>
        
        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Tracking Start Date</label>
          <p style={styles.modalHint}>
            Only weeks from this date forward will appear in the week dropdown.
          </p>
          <input
            type="date"
            value={trackingStartDate}
            onChange={e => setTrackingStartDate(e.target.value)}
            style={styles.modalInput}
          />
        </div>
        
        <div style={styles.modalActions}>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={styles.modalCancelBtn}>Cancel</button>
          <button onClick={handleSave} style={styles.modalSaveBtn}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================

export default function App() {
  const { 
    goals, entries, milestones, settings, isLoaded, 
    addGoal, deleteGoal, toggleEntry, reorderGoals,
    saveMilestone, deleteMilestone, saveSetting
  } = useGoals();
  const [newGoal, setNewGoal] = useState('');
  const [newTarget, setNewTarget] = useState(7);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [showMilestoneEditor, setShowMilestoneEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const today = getToday();
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const trackingStartDate = settings.tracking_start_date || getToday();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      const oldIndex = goals.findIndex(g => g.id === active.id);
      const newIndex = goals.findIndex(g => g.id === over.id);
      const newGoals = arrayMove(goals, oldIndex, newIndex);
      reorderGoals(newGoals);
    }
  };

  const weeksWithData = useMemo(() => {
    if (goals.length === 0) return [];
    
    const weeks = [];
    for (let i = 0; i >= -52; i--) {
      const dates = getWeekDates(i);
      const weekStart = dates[0];
      
      // Stop if we've gone before tracking start date
      if (weekStart < trackingStartDate) break;
      
      const hasData = goals.some(goal => 
        dates.some(date => entries[`${goal.id}-${date}`])
      );
      
      if (i === 0 || hasData) {
        const start = formatShortDate(dates[0]);
        weeks.push({ offset: i, label: start });
      }
    }
    return weeks.reverse();
  }, [goals, entries, trackingStartDate]);

  const weekOptions = useMemo(() => {
    const options = [];
    const maxWeeksBack = weeksBetween(trackingStartDate, getToday());
    
    for (let i = 0; i >= -maxWeeksBack; i--) {
      const dates = getWeekDates(i);
      const start = formatShortDate(dates[0]);
      const end = formatShortDate(dates[6]);
      options.push({ offset: i, label: `${start} – ${end}${i === 0 ? ' (now)' : ''}` });
    }
    return options;
  }, [trackingStartDate]);

  const handleAddGoal = () => {
    if (newGoal.trim()) {
      addGoal(newGoal, newTarget);
      setNewGoal('');
      setNewTarget(7);
      setShowAddForm(false);
    }
  };

  const handleCancelAdd = () => {
    setNewGoal('');
    setNewTarget(7);
    setShowAddForm(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAddGoal();
    if (e.key === 'Escape') handleCancelAdd();
  };

  const handleEditMilestone = (milestone) => {
    setEditingMilestone(milestone);
    setShowMilestoneEditor(true);
  };

  const handleAddMilestone = () => {
    setEditingMilestone(null);
    setShowMilestoneEditor(true);
  };

  if (!isLoaded) return <div style={styles.loading}>...</div>;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Goals</h1>
        <button 
          onClick={() => setShowSettings(true)} 
          style={styles.settingsBtn}
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      {/* Milestones Bar */}
      <MilestonesBar
        milestones={milestones}
        goals={goals}
        entries={entries}
        onEdit={handleEditMilestone}
        onAdd={handleAddMilestone}
      />

      {/* Add Goal */}
      {!showAddForm ? (
        <button onClick={() => setShowAddForm(true)} style={styles.addGoalBtn}>
          + Add Goal
        </button>
      ) : (
        <div style={styles.addContainer}>
          <div style={styles.addField}>
            <label style={styles.addLabel}>Goal</label>
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Exercise"
              style={styles.input}
              autoFocus
            />
          </div>
          <div style={styles.addField}>
            <label style={styles.addLabel}>Days/week</label>
            <div style={styles.dayButtons}>
              {[1, 2, 3, 4, 5, 6, 7].map(n => (
                <button
                  key={n}
                  onClick={() => setNewTarget(n)}
                  style={{
                    ...styles.dayBtn,
                    background: newTarget === n ? '#222' : '#fff',
                    color: newTarget === n ? '#fff' : '#666',
                    borderColor: newTarget === n ? '#222' : '#ddd'
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleAddGoal} style={styles.addBtn}>Add</button>
          <button onClick={handleCancelAdd} style={styles.cancelBtn}>×</button>
        </div>
      )}

      {/* Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.thGoal}>
                <select 
                  value={weekOffset} 
                  onChange={(e) => setWeekOffset(parseInt(e.target.value))}
                  style={styles.weekSelectInline}
                >
                  {weekOptions.map(opt => (
                    <option key={opt.offset} value={opt.offset}>{opt.label}</option>
                  ))}
                </select>
              </th>
              {DAY_LABELS.map((day, i) => {
                const isToday = weekDates[i] === today;
                return (
                  <th 
                    key={i} 
                    style={styles.thDay}
                  >
                    <div style={{ color: isToday ? '#000' : '#333' }}>{day}</div>
                    <div style={{ 
                      ...styles.thDate, 
                      color: isToday ? '#666' : '#aaa' 
                    }}>
                      {formatDayDate(weekDates[i])}
                    </div>
                  </th>
                );
              })}
              <th style={styles.thPct}></th>
            </tr>
          </thead>
          <tbody>
            {goals.length === 0 ? (
              <tr>
                <td colSpan={9} style={styles.emptyRow}>
                  No goals yet
                </td>
              </tr>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={goals.map(g => g.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {goals.map(goal => (
                    <SortableRow
                      key={goal.id}
                      goal={goal}
                      weekDates={weekDates}
                      today={today}
                      entries={entries}
                      toggleEntry={toggleEntry}
                      deleteGoal={deleteGoal}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </tbody>
        </table>
      </div>

      {/* Performance Toggle */}
      {goals.length > 0 && weeksWithData.length > 0 && (
        <div style={styles.performanceSection}>
          <button 
            onClick={() => setShowPerformance(!showPerformance)}
            style={styles.performanceToggle}
          >
            {showPerformance ? '▾ History' : '▸ History'}
          </button>
          
          {showPerformance && (
            <div style={styles.performanceTable}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.thGoal}></th>
                    {weeksWithData.map(week => (
                      <th key={week.offset} style={styles.thWeek}>
                        {week.label}
                      </th>
                    ))}
                    <th style={styles.thPct}>Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {goals.map(goal => {
                    const weeklyPcts = weeksWithData.map(week => {
                      const dates = getWeekDates(week.offset);
                      const achieved = dates.filter(d => entries[`${goal.id}-${d}`]).length;
                      const target = goal.target || 7;
                      return Math.round((achieved / target) * 100);
                    });
                    const avgPct = Math.round(weeklyPcts.reduce((a, b) => a + b, 0) / weeklyPcts.length);
                    
                    return (
                      <tr key={goal.id}>
                        <td style={styles.tdGoalPerf}>{goal.name}</td>
                        {weeklyPcts.map((pct, i) => (
                          <td 
                            key={weeksWithData[i].offset} 
                            style={{
                              ...styles.tdPerfPct,
                              color: pct >= 100 ? '#22c55e' : '#999'
                            }}
                          >
                            {pct}%
                          </td>
                        ))}
                        <td style={{
                          ...styles.tdPerfPct,
                          fontWeight: '600',
                          color: avgPct >= 100 ? '#22c55e' : '#999'
                        }}>
                          {avgPct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Milestone Editor Modal */}
      {showMilestoneEditor && (
        <MilestoneEditor
          milestone={editingMilestone}
          onSave={saveMilestone}
          onDelete={deleteMilestone}
          onClose={() => setShowMilestoneEditor(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={saveSetting}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// ============================================
// STYLES
// ============================================

const styles = {
  container: {
    maxWidth: '540px',
    margin: '0 auto',
    padding: '30px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#999',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111',
    margin: 0,
  },
  settingsBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px',
    opacity: 0.6,
    transition: 'opacity 0.15s',
  },
  weekSelect: {
    padding: '6px 10px',
    fontSize: '13px',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    background: '#fff',
    color: '#666',
    cursor: 'pointer',
    outline: 'none',
  },
  weekSelectInline: {
    padding: '4px 6px',
    fontSize: '11px',
    border: '1px solid #e5e5e5',
    borderRadius: '4px',
    background: '#fff',
    color: '#666',
    cursor: 'pointer',
    outline: 'none',
  },
  milestonesBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '16px',
  },
  milestoneBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    background: '#f9f9f9',
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  milestoneName: {
    color: '#333',
    fontWeight: '500',
    marginRight: '4px',
  },
  milestoneDays: {
    color: '#666',
  },
  milestoneDivider: {
    color: '#ddd',
  },
  milestonePct: {
    fontWeight: '600',
  },
  addMilestoneBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: '1px dashed #ddd',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#999',
    cursor: 'pointer',
  },
  addGoalBtn: {
    padding: '8px 14px',
    background: 'transparent',
    color: '#999',
    border: '1px dashed #ddd',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    marginBottom: '16px',
    width: '100%',
  },
  addContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    alignItems: 'flex-end',
    padding: '14px',
    background: '#fafafa',
    borderRadius: '8px',
  },
  addField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  addLabel: {
    fontSize: '11px',
    color: '#999',
    fontWeight: '500',
  },
  input: {
    width: '140px',
    padding: '7px 10px',
    border: '1px solid #e0e0e0',
    borderRadius: '5px',
    fontSize: '13px',
    outline: 'none',
  },
  dayButtons: {
    display: 'flex',
    gap: '3px',
  },
  dayBtn: {
    width: '24px',
    height: '28px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
  },
  addBtn: {
    padding: '8px 16px',
    background: '#222',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '8px 12px',
    background: '#fff',
    color: '#999',
    border: '1px solid #e0e0e0',
    borderRadius: '5px',
    fontSize: '16px',
    cursor: 'pointer',
    lineHeight: 1,
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  thGoal: {
    textAlign: 'left',
    padding: '8px 4px',
    fontWeight: '500',
    color: '#bbb',
    minWidth: '140px',
  },
  thDay: {
    textAlign: 'center',
    padding: '8px 4px',
    fontWeight: '600',
    fontSize: '14px',
    width: '44px',
    color: '#222',
  },
  thDate: {
    fontSize: '11px',
    fontWeight: '400',
    marginTop: '2px',
    color: '#999',
  },
  thPct: {
    textAlign: 'right',
    padding: '8px 4px',
    fontWeight: '500',
    color: '#bbb',
    width: '40px',
  },
  tdGoal: {
    padding: '10px 4px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    borderBottom: '1px solid #f5f5f5',
  },
  dragHandle: {
    cursor: 'grab',
    color: '#ccc',
    fontSize: '12px',
    userSelect: 'none',
    transition: 'opacity 0.15s',
  },
  goalText: {
    color: '#333',
    flex: 1,
    whiteSpace: 'nowrap',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#ccc',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '2px 6px',
    lineHeight: 1,
    transition: 'opacity 0.15s',
  },
  tdDay: {
    textAlign: 'center',
    padding: '6px 4px',
    borderBottom: '1px solid #f5f5f5',
  },
  tdPct: {
    textAlign: 'right',
    padding: '6px 4px',
    fontSize: '12px',
    fontWeight: '500',
    borderBottom: '1px solid #f5f5f5',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
  },
  check: {
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
  },
  emptyRow: {
    padding: '30px',
    textAlign: 'center',
    color: '#ccc',
    fontSize: '13px',
  },
  performanceSection: {
    marginTop: '24px',
  },
  performanceToggle: {
    background: 'none',
    border: 'none',
    color: '#999',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '4px 0',
    marginBottom: '8px',
  },
  performanceTable: {
    overflowX: 'auto',
  },
  thWeek: {
    textAlign: 'center',
    padding: '8px 6px',
    fontWeight: '500',
    color: '#bbb',
    fontSize: '10px',
    minWidth: '50px',
  },
  tdGoalPerf: {
    padding: '8px 4px',
    color: '#666',
    fontSize: '12px',
  },
  tdPerfPct: {
    textAlign: 'center',
    padding: '8px 6px',
    fontSize: '11px',
  },
  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: '12px',
    padding: '24px',
    width: '90%',
    maxWidth: '360px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111',
    margin: '0 0 20px 0',
  },
  modalField: {
    marginBottom: '16px',
  },
  modalRow: {
    display: 'flex',
    gap: '12px',
  },
  modalLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#666',
    marginBottom: '6px',
    fontWeight: '500',
  },
  modalHint: {
    fontSize: '11px',
    color: '#999',
    margin: '0 0 8px 0',
  },
  modalInput: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  modalActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '24px',
  },
  modalDeleteBtn: {
    padding: '10px 16px',
    background: '#fff',
    color: '#ef4444',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  modalCancelBtn: {
    padding: '10px 16px',
    background: '#fff',
    color: '#666',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  modalSaveBtn: {
    padding: '10px 20px',
    background: '#222',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
};

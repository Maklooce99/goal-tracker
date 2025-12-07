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
// THEME COLORS
// ============================================

const lightTheme = {
  bg: '#ffffff',
  bgSecondary: '#fafafa',
  bgHover: '#f9f9f9',
  bgCheckbox: '#f5f5f5',
  text: '#111111',
  textSecondary: '#333333',
  textMuted: '#666666',
  textFaint: '#999999',
  border: '#e5e5e5',
  borderLight: '#f0f0f0',
  borderDashed: '#dddddd',
  checkboxChecked: '#222222',
  checkboxBorder: '#dddddd',
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444',
  modalOverlay: 'rgba(0,0,0,0.4)',
};

const darkTheme = {
  bg: '#1a1a1a',
  bgSecondary: '#252525',
  bgHover: '#2a2a2a',
  bgCheckbox: '#333333',
  text: '#f0f0f0',
  textSecondary: '#cccccc',
  textMuted: '#999999',
  textFaint: '#666666',
  border: '#3a3a3a',
  borderLight: '#2a2a2a',
  borderDashed: '#444444',
  checkboxChecked: '#f0f0f0',
  checkboxBorder: '#555555',
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444',
  modalOverlay: 'rgba(0,0,0,0.7)',
};

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
  const [objectives, setObjectives] = useState([]);
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

        const { data: objectivesData, error: objectivesError } = await supabase
          .from('objective')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });
        
        if (objectivesError) {
          console.error('Objectives error:', objectivesError);
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
        setObjectives(objectivesData || []);
        setSettings(settingsMap);
      } catch (err) {
        console.error('Error loading data:', err);
      }
      setIsLoaded(true);
    };

    loadData();
  }, []);

  const addGoal = useCallback(async (name, target = 7, objectiveId = null) => {
    if (!name?.trim()) return;
    
    const maxOrder = goals.reduce((max, g) => Math.max(max, g.sort_order || 0), 0);
    
    const newGoal = {
      name: name.trim(),
      target: Math.min(7, Math.max(1, target)),
      sort_order: maxOrder + 1,
      objective_id: objectiveId
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
        objective_id: goal.objective_id,
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

  const saveObjective = useCallback(async (objectiveData, existingId = null, selectedGoalIds = []) => {
    try {
      let objectiveId = existingId;
      
      if (existingId) {
        const { data, error } = await supabase
          .from('objective')
          .update(objectiveData)
          .eq('id', existingId)
          .select()
          .single();
        
        if (error) throw error;
        setObjectives(prev => prev.map(o => o.id === existingId ? data : o));
      } else {
        const maxOrder = objectives.reduce((max, o) => Math.max(max, o.sort_order || 0), 0);
        const { data, error } = await supabase
          .from('objective')
          .insert({ ...objectiveData, sort_order: maxOrder + 1 })
          .select()
          .single();
        
        if (error) throw error;
        setObjectives(prev => [...prev, data]);
        objectiveId = data.id;
      }

      // Update goal assignments
      // First, unassign all goals currently assigned to this objective
      const { error: unassignError } = await supabase
        .from('goals')
        .update({ objective_id: null })
        .eq('objective_id', objectiveId);
      
      if (unassignError) throw unassignError;

      // Then assign selected goals to this objective
      if (selectedGoalIds.length > 0) {
        const { error: assignError } = await supabase
          .from('goals')
          .update({ objective_id: objectiveId })
          .in('id', selectedGoalIds);
        
        if (assignError) throw assignError;
      }

      // Update local goals state
      setGoals(prev => prev.map(g => {
        if (selectedGoalIds.includes(g.id)) {
          return { ...g, objective_id: objectiveId };
        } else if (g.objective_id === objectiveId) {
          return { ...g, objective_id: null };
        }
        return g;
      }));

    } catch (err) {
      console.error('Error saving objective:', err);
    }
  }, [objectives]);

  const deleteObjective = useCallback(async (id) => {
    if (!id) return;
    
    try {
      // First, unlink all goals from this objective
      const { error: unlinkError } = await supabase
        .from('goals')
        .update({ objective_id: null })
        .eq('objective_id', id);
      
      if (unlinkError) throw unlinkError;
      
      // Update local goals state
      setGoals(prev => prev.map(g => g.objective_id === id ? { ...g, objective_id: null } : g));
      
      // Then delete the objective
      const { error } = await supabase
        .from('objective')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setObjectives(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      console.error('Error deleting objective:', err);
    }
  }, []);

  const updateGoalObjective = useCallback(async (goalId, objectiveId) => {
    try {
      const { error } = await supabase
        .from('goals')
        .update({ objective_id: objectiveId })
        .eq('id', goalId);
      
      if (error) throw error;
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, objective_id: objectiveId } : g));
    } catch (err) {
      console.error('Error updating goal objective:', err);
    }
  }, []);

  const updateGoal = useCallback(async (goalData, goalId) => {
    if (!goalId) return;
    
    try {
      const { data, error } = await supabase
        .from('goals')
        .update({
          name: goalData.name,
          target: goalData.target,
          objective_id: goalData.objective_id
        })
        .eq('id', goalId)
        .select()
        .single();
      
      if (error) throw error;
      setGoals(prev => prev.map(g => g.id === goalId ? data : g));
    } catch (err) {
      console.error('Error updating goal:', err);
    }
  }, []);

  return { 
    goals, entries, objectives, settings, isLoaded, 
    addGoal, deleteGoal, updateGoal, toggleEntry, reorderGoals,
    saveSetting, saveObjective, deleteObjective, updateGoalObjective
  };
};

// ============================================
// STYLE GENERATOR
// ============================================

const getStyles = (theme, isDark = false) => ({
  container: {
    maxWidth: '540px',
    margin: '0 auto',
    padding: '30px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: theme.bg,
    minHeight: '100vh',
    boxSizing: 'border-box',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: theme.textFaint,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  darkModeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: theme.text,
    margin: 0,
  },
  settingsSection: {
    marginTop: '32px',
    paddingTop: '16px',
    borderTop: `1px solid ${theme.borderLight}`,
  },
  settingsBtn: {
    background: 'none',
    border: 'none',
    fontSize: '12px',
    color: theme.textFaint,
    cursor: 'pointer',
    padding: '4px 0',
  },
  weekSelectInline: {
    padding: '4px 6px',
    fontSize: '11px',
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
    background: theme.bg,
    color: theme.textMuted,
    cursor: 'pointer',
    outline: 'none',
  },
  milestonesSection: {
    marginBottom: '20px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  sectionHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  collapseBtn: {
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    border: `1px solid ${theme.border}`,
    background: theme.bg,
    color: theme.textMuted,
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: '600',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  sectionAddBtn: {
    width: '22px',
    height: '22px',
    borderRadius: '6px',
    border: `1px solid ${theme.border}`,
    background: theme.bg,
    color: theme.textMuted,
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  milestonesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  milestoneCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: theme.bgSecondary,
    border: `1px solid ${theme.border}`,
    borderRadius: '10px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    boxSizing: 'border-box',
    borderLeft: '4px solid',
  },
  milestoneIcon: {
    fontSize: '16px',
  },
  milestoneCardName: {
    fontSize: '14px',
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  milestoneCardDays: {
    fontSize: '12px',
    color: theme.textMuted,
    whiteSpace: 'nowrap',
  },
  milestoneProgressTrack: {
    width: '80px',
    height: '6px',
    background: theme.border,
    borderRadius: '3px',
    overflow: 'hidden',
  },
  milestoneProgressBar: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  milestoneCardPct: {
    fontSize: '13px',
    fontWeight: '600',
    minWidth: '36px',
    textAlign: 'right',
  },
  objectivesSection: {
    marginBottom: '20px',
  },
  objectivesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  collapsedSummary: {
    fontSize: '13px',
    color: theme.textFaint,
    padding: '8px 0',
  },
  objectiveCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    background: theme.bgSecondary,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    borderLeft: '4px solid',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    boxSizing: 'border-box',
  },
  objectiveIcon: {
    fontSize: '14px',
    color: theme.textMuted,
  },
  objectiveName: {
    fontSize: '13px',
    fontWeight: '500',
    color: theme.text,
    flex: 1,
  },
  objectiveDays: {
    fontSize: '11px',
    color: theme.textMuted,
    whiteSpace: 'nowrap',
  },
  objectiveGoalCount: {
    fontSize: '11px',
    color: theme.textFaint,
  },
  objectiveProgressTrack: {
    width: '60px',
    height: '5px',
    background: theme.border,
    borderRadius: '3px',
    overflow: 'hidden',
  },
  objectiveProgressBar: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  objectivePct: {
    fontSize: '12px',
    fontWeight: '600',
    minWidth: '32px',
    textAlign: 'right',
  },
  objectiveSelect: {
    padding: '7px 10px',
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    fontSize: '13px',
    background: theme.bg,
    color: theme.text,
    outline: 'none',
    minWidth: '120px',
  },
  goalsSection: {
    marginBottom: '0',
  },
  addContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    alignItems: 'flex-end',
    padding: '14px',
    background: theme.bgSecondary,
    borderRadius: '8px',
  },
  addField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  addLabel: {
    fontSize: '11px',
    color: theme.textFaint,
    fontWeight: '500',
  },
  input: {
    width: '140px',
    padding: '7px 10px',
    border: `1px solid ${theme.border}`,
    borderRadius: '5px',
    fontSize: '13px',
    outline: 'none',
    background: theme.bg,
    color: theme.text,
  },
  dayButtons: {
    display: 'flex',
    gap: '3px',
  },
  dayBtn: {
    width: '24px',
    height: '28px',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
  },
  dayBtnActive: {
    background: theme.checkboxChecked,
    color: theme.bg,
    border: `1px solid ${theme.checkboxChecked}`,
  },
  dayBtnInactive: {
    background: theme.bg,
    color: theme.textMuted,
    border: `1px solid ${theme.borderDashed}`,
  },
  addBtn: {
    padding: '8px 16px',
    background: theme.checkboxChecked,
    color: theme.bg,
    border: 'none',
    borderRadius: '5px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '8px 12px',
    background: theme.bg,
    color: theme.textFaint,
    border: `1px solid ${theme.border}`,
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
    color: theme.textFaint,
    minWidth: '140px',
  },
  thDay: {
    textAlign: 'center',
    padding: '8px 4px',
    fontWeight: '600',
    fontSize: '14px',
    width: '44px',
  },
  thDayToday: {
    color: theme.text,
  },
  thDayNormal: {
    color: theme.textSecondary,
  },
  thDate: {
    fontSize: '11px',
    fontWeight: '400',
    marginTop: '2px',
  },
  thDateToday: {
    color: theme.textMuted,
  },
  thDateNormal: {
    color: theme.textFaint,
  },
  thPct: {
    textAlign: 'right',
    padding: '8px 4px',
    fontWeight: '500',
    color: theme.textFaint,
    width: '40px',
  },
  tdGoal: {
    padding: '10px 4px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    borderBottom: `1px solid ${theme.borderLight}`,
  },
  dragHandle: {
    cursor: 'grab',
    color: theme.textFaint,
    fontSize: '12px',
    userSelect: 'none',
    transition: 'opacity 0.15s',
  },
  goalText: {
    color: theme.textSecondary,
    flex: 1,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  goalTarget: {
    color: theme.textFaint,
    fontSize: '11px',
    marginLeft: '4px',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: theme.textFaint,
    fontSize: '16px',
    cursor: 'pointer',
    padding: '2px 6px',
    lineHeight: 1,
    transition: 'opacity 0.15s',
  },
  tdDay: {
    textAlign: 'center',
    padding: '6px 4px',
    borderBottom: `1px solid ${theme.borderLight}`,
  },
  tdDayToday: {
    background: theme.bgHover,
  },
  tdPct: {
    textAlign: 'right',
    padding: '6px 4px',
    fontSize: '12px',
    fontWeight: '500',
    borderBottom: `1px solid ${theme.borderLight}`,
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
  checkboxChecked: {
    background: theme.checkboxChecked,
    border: `1px solid ${theme.checkboxChecked}`,
  },
  checkboxUnchecked: {
    background: theme.bgCheckbox,
    border: `1px solid ${theme.checkboxBorder}`,
  },
  check: {
    color: theme.bg,
    fontSize: '12px',
    fontWeight: '600',
  },
  emptyRow: {
    padding: '30px',
    textAlign: 'center',
    color: theme.textFaint,
    fontSize: '13px',
  },
  performanceSection: {
    marginTop: '24px',
  },
  performanceToggle: {
    background: 'none',
    border: 'none',
    color: theme.textFaint,
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
    color: theme.textFaint,
    fontSize: '10px',
    minWidth: '50px',
  },
  tdGoalPerf: {
    padding: '8px 4px',
    color: theme.textMuted,
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
    background: theme.modalOverlay,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: theme.bg,
    borderRadius: '12px',
    padding: '24px',
    width: '90%',
    maxWidth: '360px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: theme.text,
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
    color: theme.textMuted,
    marginBottom: '6px',
    fontWeight: '500',
  },
  modalHint: {
    fontSize: '11px',
    color: theme.textFaint,
    margin: '0 0 8px 0',
  },
  modalHintInline: {
    fontSize: '11px',
    color: theme.textFaint,
    margin: '2px 0 0 0',
  },
  modalInput: {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    background: theme.bg,
    color: theme.text,
    colorScheme: isDark ? 'dark' : 'light',
  },
  modalSelect: {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    background: theme.bg,
    color: theme.text,
    cursor: 'pointer',
  },
  dayButtonsModal: {
    display: 'flex',
    gap: '6px',
  },
  dayBtnModal: {
    width: '36px',
    height: '36px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    border: 'none',
  },
  dayBtnModalActive: {
    background: theme.checkboxChecked,
    color: theme.bg,
  },
  dayBtnModalInactive: {
    background: theme.bgSecondary,
    color: theme.textMuted,
    border: `1px solid ${theme.border}`,
  },
  goalChecklist: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  goalCheckItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    background: theme.bgSecondary,
    borderRadius: '6px',
    cursor: 'pointer',
  },
  goalCheckbox: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  goalCheckmark: {
    color: theme.bg,
    fontSize: '11px',
    fontWeight: '600',
  },
  goalCheckName: {
    fontSize: '13px',
    color: theme.text,
    flex: 1,
  },
  goalCheckTarget: {
    fontSize: '11px',
    color: theme.textFaint,
  },
  modalActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '24px',
  },
  modalDeleteBtn: {
    padding: '10px 16px',
    background: theme.bg,
    color: theme.danger,
    border: `1px solid ${theme.danger}`,
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  modalCancelBtn: {
    padding: '10px 16px',
    background: theme.bg,
    color: theme.textMuted,
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  modalSaveBtn: {
    padding: '10px 20px',
    background: theme.checkboxChecked,
    color: theme.bg,
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  // Toggle switch
  toggleContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleSwitch: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    padding: '2px',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  toggleSwitchOn: {
    background: theme.success,
  },
  toggleSwitchOff: {
    background: theme.border,
  },
  toggleKnob: {
    width: '20px',
    height: '20px',
    borderRadius: '10px',
    background: '#fff',
    transition: 'transform 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  toggleKnobOn: {
    transform: 'translateX(20px)',
  },
  toggleKnobOff: {
    transform: 'translateX(0)',
  },
  // Threshold styles
  thresholdRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  thresholdItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  thresholdDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
  },
  thresholdLabel: {
    fontSize: '13px',
    color: theme.textMuted,
    width: '60px',
  },
  thresholdInput: {
    width: '50px',
    padding: '6px 8px',
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
    fontSize: '13px',
    background: theme.bg,
    color: theme.text,
    textAlign: 'center',
  },
  thresholdPercent: {
    fontSize: '13px',
    color: theme.textMuted,
  },
  thresholdValue: {
    fontSize: '13px',
    color: theme.textMuted,
  },
});

// ============================================
// SORTABLE ROW COMPONENT
// ============================================

function SortableRow({ goal, weekDates, today, entries, toggleEntry, deleteGoal, onEdit, styles, theme, thresholds }) {
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
  
  const getPctColor = (pct) => {
    if (pct >= thresholds.green) return theme.success;
    if (pct >= thresholds.yellow) return theme.warning;
    return theme.danger;
  };

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
        <span 
          onClick={() => onEdit(goal)}
          style={styles.goalText}
        >
          {goal.name}
          <span style={styles.goalTarget}>({target}x)</span>
        </span>
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
            ...(isToday ? styles.tdDayToday : {}),
          }}>
            <div
              onClick={() => toggleEntry(goal.id, date)}
              style={{
                ...styles.checkbox,
                ...(isChecked ? styles.checkboxChecked : styles.checkboxUnchecked),
              }}
            >
              {isChecked && <span style={styles.check}>✓</span>}
            </div>
          </td>
        );
      })}
      <td style={{
        ...styles.tdPct,
        color: getPctColor(pct)
      }}>
        {pct}%
      </td>
    </tr>
  );
}

// ============================================
// MILESTONE CARD COMPONENT
// ============================================

function MilestoneCard({ milestone, goals, entries, onEdit, styles, theme, thresholds, milestoneColors }) {
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

  const getPctColor = (pct) => {
    if (!milestoneColors) return theme.textMuted;
    if (pct >= thresholds.green) return theme.success;
    if (pct >= thresholds.yellow) return theme.warning;
    return theme.danger;
  };

  const statusColor = getPctColor(overallPct);

  return (
    <button onClick={() => onEdit(milestone)} style={{
      ...styles.milestoneCard,
      borderLeftColor: statusColor,
    }}>
      <span style={styles.milestoneIcon}>🎯</span>
      <span style={styles.milestoneCardName}>{milestone.name}</span>
      <span style={styles.milestoneCardDays}>{daysRemaining}d</span>
      <div style={styles.milestoneProgressTrack}>
        <div style={{
          ...styles.milestoneProgressBar,
          width: `${Math.min(100, overallPct)}%`,
          background: statusColor,
        }} />
      </div>
      <span style={{
        ...styles.milestoneCardPct,
        color: statusColor,
      }}>{overallPct}%</span>
    </button>
  );
}

// ============================================
// MILESTONES SECTION COMPONENT
// ============================================

function MilestonesSection({ milestones, goals, entries, onEdit, onAdd, styles, theme, thresholds, milestoneColors }) {
  return (
    <div style={styles.milestonesSection}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionTitle}>Milestones</span>
        <button onClick={onAdd} style={styles.sectionAddBtn}>+</button>
      </div>
      {milestones.length > 0 && (
        <div style={styles.milestonesList}>
          {milestones.map(milestone => (
            <MilestoneCard
              key={milestone.id}
              milestone={milestone}
              goals={goals}
              entries={entries}
              onEdit={onEdit}
              styles={styles}
              theme={theme}
              thresholds={thresholds}
              milestoneColors={milestoneColors}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// MILESTONE EDITOR MODAL
// ============================================

function MilestoneEditor({ milestone, onSave, onDelete, onClose, styles }) {
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
// OBJECTIVE EDITOR MODAL
// ============================================

function ObjectiveEditor({ objective, goals, onSave, onDelete, onClose, styles, theme }) {
  const [name, setName] = useState(objective?.name || '');
  const [startDate, setStartDate] = useState(objective?.start_date || '');
  const [targetDate, setTargetDate] = useState(objective?.target_date || '');
  
  // Track which goals are selected for this objective
  const [selectedGoalIds, setSelectedGoalIds] = useState(() => {
    if (!objective) return new Set();
    return new Set(goals.filter(g => g.objective_id === objective.id).map(g => g.id));
  });

  const toggleGoal = (goalId) => {
    setSelectedGoalIds(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ 
      name: name.trim(),
      start_date: startDate || null,
      target_date: targetDate || null
    }, objective?.id, Array.from(selectedGoalIds));
    onClose();
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>
          {objective ? 'Edit Objective' : 'Add Objective'}
        </h3>
        
        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Be a better parent"
            style={styles.modalInput}
            autoFocus
          />
        </div>

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Target Date (optional)</label>
          <p style={styles.modalHint}>
            Set a deadline to track progress toward this objective.
          </p>
          <div style={styles.modalRow}>
            <div style={{ flex: 1 }}>
              <label style={styles.modalLabel}>Start</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={styles.modalInput}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.modalLabel}>Target</label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                style={styles.modalInput}
              />
            </div>
          </div>
        </div>

        {goals.length > 0 && (
          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Goals</label>
            <div style={styles.goalChecklist}>
              {goals.map(goal => {
                const isSelected = selectedGoalIds.has(goal.id);
                const belongsToOther = goal.objective_id && goal.objective_id !== objective?.id;
                return (
                  <div 
                    key={goal.id} 
                    onClick={() => toggleGoal(goal.id)}
                    style={{
                      ...styles.goalCheckItem,
                      opacity: belongsToOther && !isSelected ? 0.5 : 1,
                    }}
                  >
                    <div style={{
                      ...styles.goalCheckbox,
                      background: isSelected ? theme.checkboxChecked : theme.bgCheckbox,
                      borderColor: isSelected ? theme.checkboxChecked : theme.checkboxBorder,
                    }}>
                      {isSelected && <span style={styles.goalCheckmark}>✓</span>}
                    </div>
                    <span style={styles.goalCheckName}>{goal.name}</span>
                    <span style={styles.goalCheckTarget}>({goal.target}x)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <div style={styles.modalActions}>
          {objective && (
            <button onClick={() => { onDelete(objective.id); onClose(); }} style={styles.modalDeleteBtn}>
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
// GOAL EDITOR MODAL
// ============================================

function GoalEditor({ goal, objectives, onSave, onDelete, onClose, styles }) {
  const [name, setName] = useState(goal?.name || '');
  const [target, setTarget] = useState(goal?.target || 7);
  const [objectiveId, setObjectiveId] = useState(goal?.objective_id || '');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      target,
      objective_id: objectiveId || null
    }, goal?.id);
    onClose();
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>Edit Goal</h3>
        
        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Exercise"
            style={styles.modalInput}
            autoFocus
          />
        </div>

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Days per week</label>
          <div style={styles.dayButtonsModal}>
            {[1, 2, 3, 4, 5, 6, 7].map(n => (
              <button
                key={n}
                onClick={() => setTarget(n)}
                style={{
                  ...styles.dayBtnModal,
                  ...(target === n ? styles.dayBtnModalActive : styles.dayBtnModalInactive),
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Objective (optional)</label>
          <select
            value={objectiveId || ''}
            onChange={e => setObjectiveId(e.target.value || null)}
            style={styles.modalSelect}
          >
            <option value="">None</option>
            {objectives.map(obj => (
              <option key={obj.id} value={obj.id}>{obj.name}</option>
            ))}
          </select>
        </div>
        
        <div style={styles.modalActions}>
          <button onClick={() => { onDelete(goal.id); onClose(); }} style={styles.modalDeleteBtn}>
            Delete
          </button>
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

function SettingsModal({ settings, onSave, onClose, styles, theme }) {
  const [trackingStartDate, setTrackingStartDate] = useState(
    settings.tracking_start_date || getToday()
  );
  const [thresholdGreen, setThresholdGreen] = useState(
    settings.threshold_green || '80'
  );
  const [thresholdYellow, setThresholdYellow] = useState(
    settings.threshold_yellow || '50'
  );

  const handleSave = () => {
    onSave('tracking_start_date', trackingStartDate);
    onSave('threshold_green', thresholdGreen);
    onSave('threshold_yellow', thresholdYellow);
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

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Progress Thresholds</label>
          <p style={styles.modalHint}>
            Set the percentage thresholds for color indicators.
          </p>
          <div style={styles.thresholdRow}>
            <div style={styles.thresholdItem}>
              <span style={{ ...styles.thresholdDot, background: theme.success }}></span>
              <span style={styles.thresholdLabel}>Green ≥</span>
              <input
                type="number"
                min="0"
                max="100"
                value={thresholdGreen}
                onChange={e => setThresholdGreen(e.target.value)}
                style={styles.thresholdInput}
              />
              <span style={styles.thresholdPercent}>%</span>
            </div>
            <div style={styles.thresholdItem}>
              <span style={{ ...styles.thresholdDot, background: theme.warning }}></span>
              <span style={styles.thresholdLabel}>Yellow ≥</span>
              <input
                type="number"
                min="0"
                max="100"
                value={thresholdYellow}
                onChange={e => setThresholdYellow(e.target.value)}
                style={styles.thresholdInput}
              />
              <span style={styles.thresholdPercent}>%</span>
            </div>
            <div style={styles.thresholdItem}>
              <span style={{ ...styles.thresholdDot, background: theme.danger }}></span>
              <span style={styles.thresholdLabel}>Red &lt;</span>
              <span style={styles.thresholdValue}>{thresholdYellow}%</span>
            </div>
          </div>
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
    goals, entries, objectives, settings, isLoaded, 
    addGoal, deleteGoal, updateGoal, toggleEntry, reorderGoals,
    saveSetting, saveObjective, deleteObjective
  } = useGoals();
  const [newGoal, setNewGoal] = useState('');
  const [newTarget, setNewTarget] = useState(7);
  const [newObjectiveId, setNewObjectiveId] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [editingObjective, setEditingObjective] = useState(null);
  const [showObjectiveEditor, setShowObjectiveEditor] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [objectivesExpanded, setObjectivesExpanded] = useState(true);
  const [goalsExpanded, setGoalsExpanded] = useState(true);
  
  const darkMode = settings.dark_mode === 'true';
  const theme = darkMode ? darkTheme : lightTheme;
  const styles = useMemo(() => getStyles(theme, darkMode), [theme, darkMode]);
  
  const thresholds = useMemo(() => ({
    green: parseInt(settings.threshold_green) || 80,
    yellow: parseInt(settings.threshold_yellow) || 50,
  }), [settings.threshold_green, settings.threshold_yellow]);
  
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
      addGoal(newGoal, newTarget, newObjectiveId);
      setNewGoal('');
      setNewTarget(7);
      setNewObjectiveId(null);
      setShowAddForm(false);
    }
  };

  const handleCancelAdd = () => {
    setNewGoal('');
    setNewTarget(7);
    setNewObjectiveId(null);
    setShowAddForm(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAddGoal();
    if (e.key === 'Escape') handleCancelAdd();
  };

  const handleEditObjective = (objective) => {
    setEditingObjective(objective);
    setShowObjectiveEditor(true);
  };

  const handleAddObjective = () => {
    setEditingObjective(null);
    setShowObjectiveEditor(true);
  };

  const handleEditGoal = (goal) => {
    setEditingGoal(goal);
    setShowGoalEditor(true);
  };

  const handleToggleDarkMode = () => {
    saveSetting('dark_mode', darkMode ? 'false' : 'true');
  };

  // Set body background color for dark mode
  useEffect(() => {
    document.body.style.background = theme.bg;
    document.body.style.margin = '0';
  }, [theme]);

  if (!isLoaded) return <div style={styles.loading}>...</div>;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Goal Tracker</h1>
        <button 
          onClick={handleToggleDarkMode}
          style={styles.darkModeBtn}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Objectives Section */}
      <div style={styles.objectivesSection}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionHeaderLeft}>
            <button 
              onClick={() => setObjectivesExpanded(!objectivesExpanded)} 
              style={styles.collapseBtn}
            >
              {objectivesExpanded ? '−' : '+'}
            </button>
            <span style={styles.sectionTitle}>Objectives</span>
          </div>
          {objectivesExpanded && (
            <button onClick={handleAddObjective} style={styles.sectionAddBtn}>+</button>
          )}
        </div>
        {objectivesExpanded ? (
          objectives.length > 0 && (
            <div style={styles.objectivesList}>
              {objectives.map(objective => {
                const objectiveGoals = goals.filter(g => g.objective_id === objective.id);
                const hasDeadline = objective.target_date;
                const daysRemaining = hasDeadline ? daysBetween(today, objective.target_date) : null;
                
                // Calculate progress
                let pct = 0;
                if (hasDeadline && objective.start_date && objectiveGoals.length > 0) {
                  // Use milestone-style calculation for objectives with deadlines
                  const startWeek = getWeekStart(objective.start_date);
                  const currentWeek = getWeekStart(today);
                  const weeksCount = Math.max(1, Math.floor(daysBetween(startWeek, currentWeek) / 7) + 1);
                  
                  let totalExpected = 0;
                  let totalAchieved = 0;
                  
                  objectiveGoals.forEach(goal => {
                    const target = goal.target || 7;
                    totalExpected += target * weeksCount;
                    
                    let currentDate = new Date(objective.start_date);
                    const endDate = new Date(today);
                    
                    while (currentDate <= endDate) {
                      const dateStr = getDateString(currentDate);
                      if (entries[`${goal.id}-${dateStr}`]) {
                        totalAchieved++;
                      }
                      currentDate.setDate(currentDate.getDate() + 1);
                    }
                  });
                  
                  pct = totalExpected > 0 ? Math.round((totalAchieved / totalExpected) * 100) : 0;
                } else {
                  // Simple weekly calculation for objectives without deadlines
                  const totalTarget = objectiveGoals.reduce((sum, g) => sum + (g.target || 7), 0);
                  const totalAchieved = objectiveGoals.reduce((sum, g) => {
                    return sum + weekDates.filter(d => entries[`${g.id}-${d}`]).length;
                  }, 0);
                  pct = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
                }
                
                const pctColor = pct >= thresholds.green ? theme.success : pct >= thresholds.yellow ? theme.warning : theme.danger;
                
                return (
                  <button 
                    key={objective.id} 
                    onClick={() => handleEditObjective(objective)}
                    style={{
                      ...styles.objectiveCard,
                      borderLeftColor: hasDeadline ? pctColor : theme.border,
                    }}
                  >
                    <span style={styles.objectiveIcon}>◎</span>
                    <span style={styles.objectiveName}>{objective.name}</span>
                    {hasDeadline && (
                      <span style={styles.objectiveDays}>{daysRemaining}d</span>
                    )}
                    {!hasDeadline && (
                      <span style={styles.objectiveGoalCount}>{objectiveGoals.length} goals</span>
                    )}
                    {hasDeadline && (
                      <div style={styles.objectiveProgressTrack}>
                        <div style={{
                          ...styles.objectiveProgressBar,
                          width: `${Math.min(100, pct)}%`,
                          background: pctColor,
                        }} />
                      </div>
                    )}
                    <span style={{ ...styles.objectivePct, color: objectiveGoals.length > 0 ? pctColor : theme.textFaint }}>{pct}%</span>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <div style={styles.collapsedSummary}>
            {objectives.length} {objectives.length === 1 ? 'objective' : 'objectives'}
          </div>
        )}
      </div>

      {/* Goals Section */}
      <div style={styles.goalsSection}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionHeaderLeft}>
            <button 
              onClick={() => setGoalsExpanded(!goalsExpanded)} 
              style={styles.collapseBtn}
            >
              {goalsExpanded ? '−' : '+'}
            </button>
            <span style={styles.sectionTitle}>Goals</span>
          </div>
          {goalsExpanded && !showAddForm && (
            <button onClick={() => setShowAddForm(true)} style={styles.sectionAddBtn}>+</button>
          )}
        </div>
        
        {goalsExpanded ? (
          <>
            {showAddForm && (
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
                          ...(newTarget === n ? styles.dayBtnActive : styles.dayBtnInactive),
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                {objectives.length > 0 && (
                  <div style={styles.addField}>
                    <label style={styles.addLabel}>Objective (optional)</label>
                    <select
                      value={newObjectiveId || ''}
                      onChange={(e) => setNewObjectiveId(e.target.value || null)}
                      style={styles.objectiveSelect}
                    >
                      <option value="">None</option>
                      {objectives.map(obj => (
                        <option key={obj.id} value={obj.id}>{obj.name}</option>
                      ))}
                    </select>
                  </div>
                )}
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
                          <div style={isToday ? styles.thDayToday : styles.thDayNormal}>{day}</div>
                          <div style={{ 
                            ...styles.thDate, 
                            ...(isToday ? styles.thDateToday : styles.thDateNormal),
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
                            onEdit={handleEditGoal}
                            styles={styles}
                            theme={theme}
                            thresholds={thresholds}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div style={styles.collapsedSummary}>
            {goals.length} {goals.length === 1 ? 'goal' : 'goals'}
            {goals.length > 0 && (() => {
              const avgPct = Math.round(
                goals.reduce((sum, goal) => {
                  const achieved = weekDates.filter(d => entries[`${goal.id}-${d}`]).length;
                  const target = goal.target || 7;
                  return sum + (achieved / target) * 100;
                }, 0) / goals.length
              );
              return ` • ${avgPct}% avg`;
            })()}
          </div>
        )}
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
                    
                    const getPctColor = (pct) => {
                      if (pct >= thresholds.green) return theme.success;
                      if (pct >= thresholds.yellow) return theme.warning;
                      return theme.danger;
                    };
                    
                    return (
                      <tr key={goal.id}>
                        <td style={styles.tdGoalPerf}>{goal.name}</td>
                        {weeklyPcts.map((pct, i) => (
                          <td 
                            key={weeksWithData[i].offset} 
                            style={{
                              ...styles.tdPerfPct,
                              color: getPctColor(pct)
                            }}
                          >
                            {pct}%
                          </td>
                        ))}
                        <td style={{
                          ...styles.tdPerfPct,
                          fontWeight: '600',
                          color: getPctColor(avgPct)
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

      {/* Settings Link */}
      <div style={styles.settingsSection}>
        <button 
          onClick={() => setShowSettings(true)} 
          style={styles.settingsBtn}
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Objective Editor Modal */}
      {showObjectiveEditor && (
        <ObjectiveEditor
          objective={editingObjective}
          goals={goals}
          onSave={saveObjective}
          onDelete={deleteObjective}
          onClose={() => setShowObjectiveEditor(false)}
          styles={styles}
          theme={theme}
        />
      )}

      {/* Goal Editor Modal */}
      {showGoalEditor && (
        <GoalEditor
          goal={editingGoal}
          objectives={objectives}
          onSave={updateGoal}
          onDelete={deleteGoal}
          onClose={() => setShowGoalEditor(false)}
          styles={styles}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={saveSetting}
          onClose={() => setShowSettings(false)}
          styles={styles}
          theme={theme}
        />
      )}
    </div>
  );
}

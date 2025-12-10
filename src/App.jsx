import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

// Calculate streak for a goal - consecutive days checked going backwards from today
const calculateStreak = (goalId, entries, today) => {
  let streak = 0;
  
  // Parse today's date properly
  const [year, month, day] = today.split('-').map(Number);
  let currentDate = new Date(year, month - 1, day);
  currentDate.setHours(12, 0, 0, 0);
  
  // First, check if today is checked. If not, start from yesterday.
  const todayStr = getDateString(currentDate);
  if (!entries[`${goalId}-${todayStr}`]) {
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  // Now count backwards while consecutive days are checked
  while (true) {
    const dateStr = getDateString(currentDate);
    if (entries[`${goalId}-${dateStr}`]) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
    // Safety limit to prevent infinite loop
    if (streak > 365) break;
  }
  
  return streak;
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
  const [tasks, setTasks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [planTemplates, setPlanTemplates] = useState([]);
  const [settings, setSettings] = useState({});
  const [activityLog, setActivityLog] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Helper to log activity
  const logActivity = useCallback(async (action, entityType, entityId, entityName, metadata = {}) => {
    const logEntry = {
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      metadata,
    };
    
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .insert(logEntry)
        .select()
        .single();
      
      if (error) throw error;
      setActivityLog(prev => [data, ...prev]);
    } catch (err) {
      console.error('Error logging activity:', err);
    }
  }, []);

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
          .is('completed_at', null)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });
        
        if (objectivesError) {
          console.error('Objectives error:', objectivesError);
        }

        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .is('completed_at', null)
          .order('created_at', { ascending: true });
        
        if (tasksError) {
          console.error('Tasks error:', tasksError);
        }

        const { data: plansData, error: plansError } = await supabase
          .from('plans')
          .select('*')
          .is('archived_at', null)
          .order('created_at', { ascending: false });
        
        if (plansError) {
          console.error('Plans error:', plansError);
        }

        const { data: planTemplatesData, error: planTemplatesError } = await supabase
          .from('plan_templates')
          .select('*')
          .order('sort_order', { ascending: true });
        
        if (planTemplatesError) {
          console.error('Plan templates error:', planTemplatesError);
        }

        const { data: activityData, error: activityError } = await supabase
          .from('activity_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);
        
        if (activityError) {
          console.error('Activity log error:', activityError);
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
        setTasks(tasksData || []);
        setPlans(plansData || []);
        setPlanTemplates(planTemplatesData || []);
        setSettings(settingsMap);
        setActivityLog(activityData || []);
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
      await logActivity('create', 'goal', data.id, data.name, { target: data.target, objective_id: objectiveId });
    } catch (err) {
      console.error('Error adding goal:', err);
    }
  }, [goals, logActivity]);

  const deleteGoal = useCallback(async (id) => {
    const goal = goals.find(g => g.id === id);
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
      if (goal) {
        await logActivity('delete', 'goal', id, goal.name, { target: goal.target, objective_id: goal.objective_id });
      }
    } catch (err) {
      console.error('Error deleting goal:', err);
    }
  }, [goals, logActivity]);

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
    const goal = goals.find(g => g.id === goalId);
    
    setEntries(prev => ({ ...prev, [key]: !currentValue }));
    
    try {
      if (currentValue) {
        const { error } = await supabase
          .from('entries')
          .delete()
          .eq('goal_id', goalId)
          .eq('date', date);
        
        if (error) throw error;
        await logActivity('uncheck', 'entry', goalId, goal?.name || 'Unknown goal', { date });
      } else {
        const { error } = await supabase
          .from('entries')
          .insert({ goal_id: goalId, date, achieved: true });
        
        if (error) throw error;
        await logActivity('check', 'entry', goalId, goal?.name || 'Unknown goal', { date });
      }
    } catch (err) {
      console.error('Error toggling entry:', err);
      setEntries(prev => ({ ...prev, [key]: currentValue }));
    }
  }, [entries, goals, logActivity]);

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
      const oldObjective = existingId ? objectives.find(o => o.id === existingId) : null;
      
      if (existingId) {
        const { data, error } = await supabase
          .from('objective')
          .update(objectiveData)
          .eq('id', existingId)
          .select()
          .single();
        
        if (error) throw error;
        setObjectives(prev => prev.map(o => o.id === existingId ? data : o));
        await logActivity('update', 'objective', existingId, data.name, {
          old: { name: oldObjective?.name, start_date: oldObjective?.start_date, target_date: oldObjective?.target_date },
          new: { name: data.name, start_date: data.start_date, target_date: data.target_date }
        });
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
        await logActivity('create', 'objective', data.id, data.name, { start_date: data.start_date, target_date: data.target_date });
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

      return { id: objectiveId };
    } catch (err) {
      console.error('Error saving objective:', err);
    }
  }, [objectives, logActivity]);

  const deleteObjective = useCallback(async (id) => {
    if (!id) return;
    const objective = objectives.find(o => o.id === id);
    
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
      if (objective) {
        await logActivity('delete', 'objective', id, objective.name, { start_date: objective.start_date, target_date: objective.target_date });
      }
    } catch (err) {
      console.error('Error deleting objective:', err);
    }
  }, [objectives, logActivity]);

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
    const oldGoal = goals.find(g => g.id === goalId);
    
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
      await logActivity('update', 'goal', goalId, data.name, { 
        old: { name: oldGoal?.name, target: oldGoal?.target, objective_id: oldGoal?.objective_id },
        new: { name: data.name, target: data.target, objective_id: data.objective_id }
      });
    } catch (err) {
      console.error('Error updating goal:', err);
    }
  }, [goals, logActivity]);

  // Task functions
  const addTask = useCallback(async (name, objectiveId = null) => {
    if (!name?.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ 
          name: name.trim(), 
          objective_id: objectiveId,
          start_date: getToday()
        })
        .select()
        .single();
      
      if (error) throw error;
      setTasks(prev => [...prev, data]);
      await logActivity('create', 'task', data.id, data.name, { objective_id: objectiveId });
    } catch (err) {
      console.error('Error adding task:', err);
    }
  }, [logActivity]);

  const updateTask = useCallback(async (taskData, taskId) => {
    if (!taskId) return;
    const oldTask = tasks.find(t => t.id === taskId);
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          name: taskData.name,
          objective_id: taskData.objective_id,
          start_date: taskData.start_date,
          target_date: taskData.target_date
        })
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId ? data : t));
      await logActivity('update', 'task', taskId, data.name, {
        old: { name: oldTask?.name, objective_id: oldTask?.objective_id },
        new: { name: data.name, objective_id: data.objective_id }
      });
    } catch (err) {
      console.error('Error updating task:', err);
    }
  }, [tasks, logActivity]);

  const toggleTaskCheck = useCallback(async (taskId, isChecked) => {
    const task = tasks.find(t => t.id === taskId);
    try {
      // Just toggle the visual check state - don't archive yet
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, checked: isChecked } : t
      ));
      await logActivity(isChecked ? 'check' : 'uncheck', 'task', taskId, task?.name || 'Unknown task', {});
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  }, [tasks, logActivity]);

  const archiveTask = useCallback(async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', taskId);
      
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (task) {
        await logActivity('archive', 'task', taskId, task.name, { objective_id: task.objective_id });
      }
    } catch (err) {
      console.error('Error archiving task:', err);
    }
  }, [tasks, logActivity]);

  const deleteTask = useCallback(async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (task) {
        await logActivity('delete', 'task', taskId, task.name, { objective_id: task.objective_id });
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  }, [tasks, logActivity]);

  const completeObjective = useCallback(async (objectiveId) => {
    const objective = objectives.find(o => o.id === objectiveId);
    try {
      const { error } = await supabase
        .from('objective')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', objectiveId);
      
      if (error) throw error;
      
      // Unlink goals from this objective
      await supabase
        .from('goals')
        .update({ objective_id: null })
        .eq('objective_id', objectiveId);
      
      setGoals(prev => prev.map(g => 
        g.objective_id === objectiveId ? { ...g, objective_id: null } : g
      ));
      setObjectives(prev => prev.filter(o => o.id !== objectiveId));
      if (objective) {
        await logActivity('complete', 'objective', objectiveId, objective.name, {});
      }
    } catch (err) {
      console.error('Error completing objective:', err);
    }
  }, [objectives, logActivity]);

  // Plan functions
  const savePlan = useCallback(async (planData) => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .insert({
          name: planData.name,
          category: planData.category || 'meal_plan',
          content: planData.content,
          summary: planData.summary
        })
        .select()
        .single();
      
      if (error) throw error;
      setPlans(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('Error saving plan:', err);
      return null;
    }
  }, []);

  const archivePlan = useCallback(async (planId) => {
    try {
      const { error } = await supabase
        .from('plans')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', planId);
      
      if (error) throw error;
      setPlans(prev => prev.filter(p => p.id !== planId));
    } catch (err) {
      console.error('Error archiving plan:', err);
    }
  }, []);

  const linkPlanItem = useCallback(async (planId, itemType, itemId) => {
    try {
      const { error } = await supabase
        .from('plan_items')
        .insert({
          plan_id: planId,
          item_type: itemType,
          item_id: itemId
        });
      
      if (error) throw error;
    } catch (err) {
      console.error('Error linking plan item:', err);
    }
  }, []);

  // Plan template functions
  const savePlanTemplate = useCallback(async (templateData, templateId = null) => {
    try {
      if (templateId) {
        // Update existing
        const { data, error } = await supabase
          .from('plan_templates')
          .update({
            name: templateData.name,
            icon: templateData.icon,
            prompt_template: templateData.prompt_template
          })
          .eq('id', templateId)
          .select()
          .single();
        
        if (error) throw error;
        setPlanTemplates(prev => prev.map(t => t.id === templateId ? data : t));
        return data;
      } else {
        // Create new
        const maxOrder = planTemplates.reduce((max, t) => Math.max(max, t.sort_order || 0), 0);
        const { data, error } = await supabase
          .from('plan_templates')
          .insert({
            name: templateData.name,
            icon: templateData.icon,
            prompt_template: templateData.prompt_template,
            sort_order: maxOrder + 1
          })
          .select()
          .single();
        
        if (error) throw error;
        setPlanTemplates(prev => [...prev, data]);
        return data;
      }
    } catch (err) {
      console.error('Error saving plan template:', err);
      return null;
    }
  }, [planTemplates]);

  const deletePlanTemplate = useCallback(async (templateId) => {
    try {
      const { error } = await supabase
        .from('plan_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) throw error;
      setPlanTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (err) {
      console.error('Error deleting plan template:', err);
    }
  }, []);

  return { 
    goals, entries, objectives, tasks, plans, planTemplates, settings, activityLog, isLoaded, 
    addGoal, deleteGoal, updateGoal, toggleEntry, reorderGoals,
    saveSetting, saveObjective, deleteObjective, completeObjective,
    addTask, updateTask, toggleTaskCheck, archiveTask, deleteTask,
    savePlan, archivePlan, linkPlanItem,
    savePlanTemplate, deletePlanTemplate
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
    display: 'flex',
    gap: '16px',
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
  sectionCount: {
    fontSize: '11px',
    fontWeight: '500',
    color: theme.textFaint,
  },
  sectionAvg: {
    fontSize: '11px',
    fontWeight: '500',
    color: theme.textMuted,
    marginLeft: '4px',
  },
  goalMetrics: {
    display: 'flex',
    gap: '12px',
    marginLeft: '8px',
  },
  goalMetricItem: {
    fontSize: '11px',
    color: theme.textFaint,
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
  objectiveCardWrapper: {
    display: 'flex',
    flexDirection: 'column',
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
  objectiveExpandIcon: {
    fontSize: '14px',
    color: theme.textFaint,
    transition: 'transform 0.2s ease',
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
  objectiveExpanded: {
    background: theme.bgSecondary,
    border: `1px solid ${theme.border}`,
    borderTop: 'none',
    borderBottomLeftRadius: '8px',
    borderBottomRightRadius: '8px',
    padding: '12px 14px',
  },
  objectiveNoGoals: {
    fontSize: '12px',
    color: theme.textFaint,
    fontStyle: 'italic',
  },
  objectiveGoalsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  objectiveGoalRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  objectiveGoalName: {
    fontSize: '12px',
    color: theme.textSecondary,
    flex: 1,
  },
  objectiveGoalFraction: {
    fontSize: '11px',
    color: theme.textMuted,
    minWidth: '36px',
    textAlign: 'right',
  },
  objectiveGoalProgressTrack: {
    width: '50px',
    height: '4px',
    background: theme.border,
    borderRadius: '2px',
    overflow: 'hidden',
  },
  objectiveGoalProgressBar: {
    height: '100%',
    borderRadius: '2px',
  },
  objectiveGoalPct: {
    fontSize: '11px',
    fontWeight: '500',
    minWidth: '28px',
    textAlign: 'right',
  },
  objectiveEditBtn: {
    marginTop: '12px',
    padding: '6px 12px',
    background: 'transparent',
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
    fontSize: '12px',
    color: theme.textMuted,
    cursor: 'pointer',
  },
  objectiveCompleteBtn: {
    marginTop: '12px',
    marginLeft: '8px',
    padding: '6px 12px',
    background: theme.success,
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#fff',
    cursor: 'pointer',
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
  // Tasks section
  tasksSection: {
    marginBottom: '20px',
  },
  tasksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  taskItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    background: theme.bgSecondary,
    borderRadius: '6px',
  },
  taskCheckbox: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: `2px solid ${theme.checkboxBorder}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    background: theme.bgCheckbox,
  },
  taskCheckboxChecked: {
    background: theme.checkboxChecked,
    borderColor: theme.checkboxChecked,
  },
  taskCheckmark: {
    color: theme.bg,
    fontSize: '11px',
    fontWeight: '600',
  },
  taskName: {
    fontSize: '13px',
    color: theme.text,
    flex: 1,
    cursor: 'pointer',
  },
  taskNameChecked: {
    textDecoration: 'line-through',
    color: theme.textMuted,
  },
  taskObjectiveTag: {
    fontSize: '10px',
    color: theme.textFaint,
    background: theme.border,
    padding: '2px 6px',
    borderRadius: '3px',
  },
  taskDays: {
    fontSize: '11px',
    color: theme.textFaint,
  },
  taskArchiveBtn: {
    fontSize: '11px',
    color: theme.success,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  taskDeleteBtn: {
    fontSize: '14px',
    color: theme.textFaint,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 6px',
    opacity: 0.5,
  },
  taskAddContainer: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
    alignItems: 'center',
  },
  taskInput: {
    flex: 1,
    padding: '8px 10px',
    border: `1px solid ${theme.border}`,
    borderRadius: '5px',
    fontSize: '13px',
    outline: 'none',
    background: theme.bg,
    color: theme.text,
  },
  taskObjectiveSelect: {
    padding: '8px 10px',
    border: `1px solid ${theme.border}`,
    borderRadius: '5px',
    fontSize: '12px',
    background: theme.bg,
    color: theme.text,
    outline: 'none',
    maxWidth: '120px',
  },
  // Trophy case
  trophySection: {
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: `1px solid ${theme.border}`,
  },
  trophyHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    padding: '8px 0',
  },
  trophyIcon: {
    fontSize: '16px',
  },
  trophyTitle: {
    fontSize: '13px',
    fontWeight: '500',
    color: theme.textMuted,
  },
  trophyCount: {
    fontSize: '11px',
    color: theme.textFaint,
  },
  trophyExpandIcon: {
    fontSize: '12px',
    color: theme.textFaint,
    marginLeft: 'auto',
  },
  trophyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '8px',
  },
  trophyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background: theme.bgSecondary,
    borderRadius: '6px',
  },
  trophyItemIcon: {
    fontSize: '12px',
    color: theme.textFaint,
  },
  trophyItemName: {
    fontSize: '13px',
    color: theme.textSecondary,
    flex: 1,
  },
  trophyItemDate: {
    fontSize: '11px',
    color: theme.textFaint,
  },
  // AI Planning styles
  aiPlannerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '14px 16px',
    background: `linear-gradient(135deg, ${theme.bgSecondary} 0%, ${theme.bg} 100%)`,
    border: `1px solid ${theme.border}`,
    borderRadius: '10px',
    cursor: 'pointer',
    marginBottom: '20px',
    textAlign: 'left',
  },
  aiPlannerIcon: {
    fontSize: '20px',
  },
  aiPlannerText: {
    flex: 1,
  },
  aiPlannerTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: theme.text,
  },
  aiPlannerSubtitle: {
    fontSize: '12px',
    color: theme.textMuted,
  },
  aiPlannerArrow: {
    fontSize: '16px',
    color: theme.textFaint,
  },
  // AI Modal
  aiModalOverlay: {
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
    padding: '20px',
  },
  aiModal: {
    background: theme.bg,
    borderRadius: '12px',
    width: '100%',
    maxWidth: '480px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  aiModalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '16px 20px',
    borderBottom: `1px solid ${theme.border}`,
  },
  aiModalIcon: {
    fontSize: '20px',
  },
  aiModalTitle: {
    flex: 1,
    fontSize: '16px',
    fontWeight: '600',
    color: theme.text,
  },
  aiModalClose: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    color: theme.textMuted,
    cursor: 'pointer',
    padding: '4px',
  },
  aiModalBody: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
  },
  // Intro screen styles
  aiIntro: {
    textAlign: 'center',
    padding: '10px 0',
  },
  aiIntroHeadline: {
    fontSize: '18px',
    fontWeight: '600',
    color: theme.text,
    marginBottom: '24px',
    lineHeight: '1.4',
  },
  aiIntroSection: {
    textAlign: 'left',
    marginBottom: '20px',
  },
  aiIntroLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: theme.textMuted,
    marginBottom: '8px',
  },
  aiIntroBullets: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  aiIntroBullet: {
    fontSize: '14px',
    color: theme.text,
    padding: '4px 0',
  },
  aiIntroDuration: {
    fontSize: '13px',
    color: theme.textFaint,
    marginTop: '24px',
  },
  aiQuestion: {
    marginBottom: '20px',
  },
  aiQuestionText: {
    fontSize: '14px',
    fontWeight: '500',
    color: theme.text,
    marginBottom: '10px',
  },
  aiQuestionInput: {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    fontSize: '14px',
    background: theme.bg,
    color: theme.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  aiInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  aiInputSuffix: {
    fontSize: '14px',
    color: theme.textMuted,
  },
  aiChoices: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  aiChoice: {
    padding: '10px 14px',
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    background: theme.bg,
    color: theme.text,
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  aiChoiceSelected: {
    borderColor: theme.checkboxChecked,
    background: theme.bgSecondary,
  },
  aiProgress: {
    display: 'flex',
    gap: '6px',
    marginBottom: '20px',
  },
  aiProgressDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: theme.border,
  },
  aiProgressDotActive: {
    background: theme.checkboxChecked,
  },
  aiProgressDotComplete: {
    background: theme.success,
  },
  aiModalFooter: {
    display: 'flex',
    gap: '10px',
    padding: '16px 20px',
    borderTop: `1px solid ${theme.border}`,
  },
  aiBackBtn: {
    padding: '10px 16px',
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    background: theme.bg,
    color: theme.textMuted,
    fontSize: '13px',
    cursor: 'pointer',
  },
  aiNextBtn: {
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderRadius: '6px',
    background: theme.checkboxChecked,
    color: theme.bg,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  aiNextBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  // AI Loading state
  aiLoading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    gap: '16px',
  },
  aiLoadingSpinner: {
    width: '32px',
    height: '32px',
    border: `3px solid ${theme.border}`,
    borderTopColor: theme.checkboxChecked,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  aiLoadingText: {
    fontSize: '14px',
    color: theme.textMuted,
  },
  aiLoadingSubtext: {
    fontSize: '12px',
    color: theme.textFaint,
  },
  // Plan viewer
  planViewer: {
    padding: '0',
  },
  planHeader: {
    marginBottom: '16px',
  },
  planName: {
    fontSize: '18px',
    fontWeight: '600',
    color: theme.text,
    marginBottom: '4px',
  },
  planSummary: {
    fontSize: '13px',
    color: theme.textMuted,
  },
  planDay: {
    marginBottom: '16px',
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    overflow: 'hidden',
  },
  planDayHeader: {
    padding: '10px 14px',
    background: theme.bgSecondary,
    fontWeight: '600',
    fontSize: '13px',
    color: theme.text,
  },
  planMeal: {
    padding: '12px 14px',
    borderTop: `1px solid ${theme.borderLight}`,
  },
  planMealType: {
    fontSize: '11px',
    fontWeight: '600',
    color: theme.textFaint,
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  planMealName: {
    fontSize: '14px',
    fontWeight: '500',
    color: theme.text,
    marginBottom: '6px',
  },
  planMealMeta: {
    fontSize: '12px',
    color: theme.textMuted,
    marginBottom: '6px',
  },
  planMealIngredients: {
    fontSize: '12px',
    color: theme.textSecondary,
    lineHeight: '1.5',
  },
  planSection: {
    marginTop: '20px',
    padding: '14px',
    background: theme.bgSecondary,
    borderRadius: '8px',
  },
  planSectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: theme.text,
    marginBottom: '10px',
  },
  planSectionList: {
    fontSize: '12px',
    color: theme.textSecondary,
    lineHeight: '1.6',
  },
  planActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
  },
  planSaveBtn: {
    flex: 1,
    padding: '12px',
    border: `1px solid ${theme.border}`,
    borderRadius: '6px',
    background: theme.bg,
    color: theme.text,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  planConvertBtn: {
    flex: 1,
    padding: '12px',
    border: 'none',
    borderRadius: '6px',
    background: theme.checkboxChecked,
    color: theme.bg,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  // Conversion wizard
  conversionItem: {
    marginBottom: '16px',
    padding: '14px',
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
  },
  conversionItemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  conversionItemType: {
    fontSize: '11px',
    fontWeight: '600',
    color: theme.textFaint,
    textTransform: 'uppercase',
  },
  conversionItemName: {
    fontSize: '14px',
    fontWeight: '500',
    color: theme.text,
  },
  conversionItemWhy: {
    fontSize: '12px',
    color: theme.textMuted,
    marginBottom: '12px',
    fontStyle: 'italic',
  },
  conversionItemActions: {
    display: 'flex',
    gap: '8px',
  },
  conversionRadio: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
    fontSize: '12px',
    color: theme.textMuted,
    cursor: 'pointer',
  },
  conversionRadioSelected: {
    borderColor: theme.checkboxChecked,
    background: theme.bgSecondary,
    color: theme.text,
  },
  conversionTaskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  conversionTask: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: theme.text,
  },
  conversionTaskCheck: {
    width: '16px',
    height: '16px',
    borderRadius: '3px',
    border: `2px solid ${theme.checkboxBorder}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    background: theme.bg,
  },
  conversionTaskCheckSelected: {
    background: theme.checkboxChecked,
    borderColor: theme.checkboxChecked,
  },
  createItemsBtn: {
    width: '100%',
    padding: '14px',
    border: 'none',
    borderRadius: '6px',
    background: theme.success,
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '10px',
  },
  // Plans section
  plansSection: {
    marginBottom: '20px',
  },
  planCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    background: theme.bgSecondary,
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '8px',
  },
  planCardIcon: {
    fontSize: '18px',
  },
  planCardInfo: {
    flex: 1,
  },
  planCardName: {
    fontSize: '13px',
    fontWeight: '500',
    color: theme.text,
  },
  planCardMeta: {
    fontSize: '11px',
    color: theme.textFaint,
  },
  planCardActions: {
    display: 'flex',
    gap: '8px',
  },
  planCardBtn: {
    padding: '6px 10px',
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
    background: theme.bg,
    color: theme.textMuted,
    fontSize: '11px',
    cursor: 'pointer',
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
    flexWrap: 'wrap',
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
  streakBadge: {
    fontSize: '11px',
    marginLeft: '6px',
    color: '#f97316',
    fontWeight: '500',
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

function SortableRow({ goal, weekDates, today, entries, toggleEntry, deleteGoal, onEdit, styles, theme, thresholds, streakThreshold }) {
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
  
  // Calculate streak
  const streak = calculateStreak(goal.id, entries, today);
  const showStreak = streak >= streakThreshold;
  
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
          {showStreak && (
            <span style={styles.streakBadge}>🔥{streak}</span>
          )}
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
// OBJECTIVE CARD COMPONENT
// ============================================

function ObjectiveCard({ 
  objective, 
  goals, 
  entries, 
  weekDates, 
  today, 
  isExpanded, 
  onToggle, 
  onEdit,
  onComplete,
  styles, 
  theme, 
  thresholds 
}) {
  const objectiveGoals = goals.filter(g => g.objective_id === objective.id);
  const hasDeadline = objective.target_date;
  const daysRemaining = hasDeadline ? daysBetween(today, objective.target_date) : null;
  const totalDays = hasDeadline && objective.start_date ? daysBetween(objective.start_date, objective.target_date) + 1 : null;
  
  // Calculate goal progress using Current/Pace model
  const getGoalProgress = (goal) => {
    const target = goal.target || 7;
    
    if (objective.start_date) {
      const startDate = new Date(objective.start_date);
      startDate.setHours(12, 0, 0, 0);
      const todayDate = new Date(today);
      todayDate.setHours(12, 0, 0, 0);
      
      // Count achieved days from start to today
      let achieved = 0;
      let currentDate = new Date(startDate);
      
      while (currentDate <= todayDate) {
        const dateStr = getDateString(currentDate);
        if (entries[`${goal.id}-${dateStr}`]) {
          achieved++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Days and weeks elapsed
      const daysElapsed = daysBetween(objective.start_date, today) + 1;
      const weeksElapsed = daysElapsed / 7;
      
      // Target so far = weeks elapsed × weekly target
      const targetSoFar = weeksElapsed * target;
      
      // Current: achieved vs target so far (are you on track?)
      const current = targetSoFar > 0 ? Math.round((achieved / targetSoFar) * 100) : 0;
      
      // Pace: if deadline exists, project where you'll end up
      let pace = current; // Default to current if no deadline
      if (hasDeadline && totalDays) {
        const totalWeeks = totalDays / 7;
        const totalRequired = totalWeeks * target; // Total needed by deadline
        const dailyRate = achieved / daysElapsed;
        const projectedTotal = dailyRate * totalDays; // Projected if you continue at this rate
        pace = totalRequired > 0 ? Math.round((projectedTotal / totalRequired) * 100) : 0;
      }
      
      return { achieved, targetSoFar: Math.round(targetSoFar * 10) / 10, current, pace, daysElapsed };
    } else {
      // Current week only for objectives without start date
      const achieved = weekDates.filter(d => entries[`${goal.id}-${d}`]).length;
      const current = Math.round((achieved / target) * 100);
      return { achieved, targetSoFar: target, current, pace: current, daysElapsed: 7 };
    }
  };

  // Calculate overall objective progress (Current/Pace)
  let totalAchieved = 0;
  let totalTargetSoFar = 0;
  let totalProjected = 0;
  let totalRequired = 0;
  
  objectiveGoals.forEach(goal => {
    const progress = getGoalProgress(goal);
    const target = goal.target || 7;
    
    totalAchieved += progress.achieved;
    totalTargetSoFar += progress.targetSoFar;
    
    // For pace: project each goal to deadline
    if (hasDeadline && totalDays && progress.daysElapsed > 0) {
      const dailyRate = progress.achieved / progress.daysElapsed;
      totalProjected += dailyRate * totalDays;
      const totalWeeks = totalDays / 7;
      totalRequired += totalWeeks * target;
    }
  });
  
  const current = totalTargetSoFar > 0 ? Math.round((totalAchieved / totalTargetSoFar) * 100) : 0;
  const pace = hasDeadline && totalRequired > 0 ? Math.round((totalProjected / totalRequired) * 100) : current;
  const currentColor = current >= thresholds.green ? theme.success : current >= thresholds.yellow ? theme.warning : theme.danger;
  const paceColor = pace >= thresholds.green ? theme.success : pace >= thresholds.yellow ? theme.warning : theme.danger;

  return (
    <div style={styles.objectiveCardWrapper}>
      <button 
        onClick={onToggle}
        style={{
          ...styles.objectiveCard,
          borderLeftColor: objectiveGoals.length > 0 ? currentColor : theme.border,
          borderBottomLeftRadius: isExpanded ? 0 : '8px',
          borderBottomRightRadius: isExpanded ? 0 : '8px',
        }}
      >
        <span style={{
          ...styles.objectiveExpandIcon,
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>›</span>
        <span style={styles.objectiveName}>{objective.name}</span>
        {hasDeadline && (
          <span style={styles.objectiveDays}>{daysRemaining}d</span>
        )}
        {!hasDeadline && objectiveGoals.length === 0 && (
          <span style={styles.objectiveGoalCount}>{objectiveGoals.length} goals</span>
        )}
        {objectiveGoals.length > 0 && (
          <span style={{ fontSize: '11px', marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            <span><span style={{ color: theme.textFaint }}>Current: </span><span style={{ color: currentColor }}>{current}%</span></span>
            {hasDeadline && (
              <span><span style={{ color: theme.textFaint }}>Pace: </span><span style={{ color: paceColor }}>{pace}%</span></span>
            )}
          </span>
        )}
      </button>
      
      {isExpanded && (
        <div style={styles.objectiveExpanded}>
          {objectiveGoals.length === 0 ? (
            <div style={styles.objectiveNoGoals}>No goals assigned</div>
          ) : (
            <div style={styles.objectiveGoalsList}>
              {objectiveGoals.map(goal => {
                const progress = getGoalProgress(goal);
                const goalCurrentColor = progress.current >= thresholds.green ? theme.success : progress.current >= thresholds.yellow ? theme.warning : theme.danger;
                const goalPaceColor = progress.pace >= thresholds.green ? theme.success : progress.pace >= thresholds.yellow ? theme.warning : theme.danger;
                return (
                  <div key={goal.id} style={styles.objectiveGoalRow}>
                    <span style={styles.objectiveGoalName}>{goal.name}</span>
                    <span style={{ fontSize: '11px', marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                      <span><span style={{ color: theme.textFaint }}>Current: </span><span style={{ color: goalCurrentColor }}>{progress.current}%</span></span>
                      {hasDeadline && (
                        <span><span style={{ color: theme.textFaint }}>Pace: </span><span style={{ color: goalPaceColor }}>{progress.pace}%</span></span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(objective); }}
              style={styles.objectiveEditBtn}
            >
              ✏️ Edit
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onComplete(objective.id); }}
              style={styles.objectiveCompleteBtn}
            >
              ✓ Complete
            </button>
          </div>
        </div>
      )}
    </div>
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
// TASK EDITOR MODAL
// ============================================

function TaskEditor({ task, objectives, onSave, onDelete, onClose, styles }) {
  const [name, setName] = useState(task?.name || '');
  const [objectiveId, setObjectiveId] = useState(task?.objective_id || '');
  const [startDate, setStartDate] = useState(task?.start_date || getToday());
  const [targetDate, setTargetDate] = useState(task?.target_date || '');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      objective_id: objectiveId || null,
      start_date: startDate,
      target_date: targetDate || null
    }, task?.id);
    onClose();
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>Edit Task</h3>
        
        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Take son to football game"
            style={styles.modalInput}
            autoFocus
          />
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
            <label style={styles.modalLabel}>Target Date (optional)</label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              style={styles.modalInput}
            />
          </div>
        </div>
        
        <div style={styles.modalActions}>
          <button onClick={() => { onDelete(task.id); onClose(); }} style={styles.modalDeleteBtn}>
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
// AI PLANNER MODAL
// ============================================

// Edge Function URL for Gemini API (keeps API key server-side)
const GEMINI_EDGE_FUNCTION_URL = 'https://evapuqvlxouaoaazcmxb.supabase.co/functions/v1/gemini';

// System prompts for AI
const PLAN_SYSTEM_PROMPT = `You are a helpful planning assistant. Create practical, actionable plans based on the user's input. Be conversational and ask clarifying questions if needed before generating a plan. Keep responses concise but helpful.`;

const STRUCTURE_SYSTEM_PROMPT = `The user wants to track this plan. Break it into objectives, goals, and tasks using this framework:

**Objectives** - Outcomes or destinations. What success looks like.
- Usually 1-2 per plan
- Examples: "Follow meal plan", "Establish meditation practice"

**Goals** - Recurring habits tracked weekly. The behaviors that lead to objectives.
- Has a weekly frequency target (1-7 times per week)
- Examples: "Eat according to plan" (7x/week), "Meditate" (5x/week)

**Tasks** - One-time actions to do once and complete.
- Examples: "Buy running shoes", "Download meditation app"

Return ONLY valid JSON with this structure:
{
  "objectives": [{ "name": "...", "reason": "..." }],
  "goals": [{ "name": "...", "frequency": 7, "reason": "..." }],
  "tasks": [{ "name": "...", "reason": "..." }]
}`;

// Parse [field] syntax from template
const parseTemplateFields = (template) => {
  const regex = /\[([^\]]+)\]/g;
  const fields = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (!fields.includes(match[1])) {
      fields.push(match[1]);
    }
  }
  return fields;
};

// Render template with filled values
const renderTemplate = (template, values) => {
  let result = template;
  Object.entries(values).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\[${key}\\]`, 'g'), value || `[${key}]`);
  });
  return result;
};

function AIPlannerModal({ 
  onClose, 
  onSavePlan, 
  onCreateItems,
  planTemplates,
  styles, 
  theme 
}) {
  // Steps: select, fill, chat, structure
  const [step, setStep] = useState('select');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [structuredItems, setStructuredItems] = useState(null);
  const [selectedItems, setSelectedItems] = useState({ objectives: [], goals: [], tasks: [] });
  
  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fields = selectedTemplate ? parseTemplateFields(selectedTemplate.prompt_template) : [];
  const allFieldsFilled = fields.every(f => fieldValues[f]?.trim());

  // Send message to Gemini
  const sendMessage = async (userMessage, isInitial = false) => {
    setIsLoading(true);
    setError(null);
    
    const newMessages = isInitial 
      ? [{ role: 'user', content: userMessage }]
      : [...messages, { role: 'user', content: userMessage }];
    
    setMessages(newMessages);
    setInputValue('');
    
    try {
      // Build conversation history for API
      const conversationHistory = newMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
      
      const response = await fetch(GEMINI_EDGE_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationHistory,
          systemPrompt: PLAN_SYSTEM_PROMPT
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'API error');
      }
      
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!aiResponse) {
        throw new Error('No response from AI');
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (err) {
      console.error('AI Error:', err);
      setError(err.message || 'Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Request structure from AI
  const requestStructure = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Build conversation history + structure request
      const conversationHistory = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
      
      conversationHistory.push({
        role: 'user',
        parts: [{ text: 'Now break this plan into objectives, goals, and tasks that I can track.' }]
      });
      
      const response = await fetch(GEMINI_EDGE_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationHistory,
          systemPrompt: STRUCTURE_SYSTEM_PROMPT
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'API error');
      }
      
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!aiResponse) {
        throw new Error('No response from AI');
      }
      
      // Parse JSON from response
      let jsonStr = aiResponse.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Could not parse structure from response');
      }
      
      let cleanJson = jsonMatch[0].replace(/,\s*([}\]])/g, '$1');
      const structure = JSON.parse(cleanJson);
      
      setStructuredItems(structure);
      // Select all by default
      setSelectedItems({
        objectives: structure.objectives?.map((_, i) => i) || [],
        goals: structure.goals?.map((_, i) => i) || [],
        tasks: structure.tasks?.map((_, i) => i) || []
      });
      setStep('structure');
    } catch (err) {
      console.error('Structure Error:', err);
      setError(err.message || 'Failed to structure plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Start planning with filled template
  const startPlanning = () => {
    const filledPrompt = renderTemplate(selectedTemplate.prompt_template, fieldValues);
    setStep('chat');
    sendMessage(filledPrompt, true);
  };

  // Toggle item selection
  const toggleItem = (type, index) => {
    setSelectedItems(prev => ({
      ...prev,
      [type]: prev[type].includes(index)
        ? prev[type].filter(i => i !== index)
        : [...prev[type], index]
    }));
  };

  // Create selected items
  const handleCreateItems = async () => {
    const items = {
      objectives: selectedItems.objectives.map(i => structuredItems.objectives[i]),
      goals: selectedItems.goals.map(i => structuredItems.goals[i]),
      tasks: selectedItems.tasks.map(i => structuredItems.tasks[i])
    };
    
    // Save conversation as plan
    const planContent = {
      template: selectedTemplate.name,
      messages: messages,
      structure: structuredItems
    };
    
    const savedPlan = await onSavePlan({
      name: `${selectedTemplate.name} - ${new Date().toLocaleDateString()}`,
      category: selectedTemplate.name.toLowerCase().replace(/\s+/g, '_'),
      content: planContent,
      summary: `Created from ${selectedTemplate.name} template`
    });

    if (savedPlan) {
      await onCreateItems(items, savedPlan.id);
      onClose();
    }
  };

  // Handle enter key in input
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && inputValue.trim() && !isLoading) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  return (
    <div style={styles.aiModalOverlay} onClick={onClose}>
      <div style={{...styles.aiModal, maxHeight: '80vh'}} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.aiModalHeader}>
          <span style={styles.aiModalIcon}>
            {step === 'select' ? '✨' : selectedTemplate?.icon || '📋'}
          </span>
          <span style={styles.aiModalTitle}>
            {step === 'select' ? 'Plan with AI' : 
             step === 'structure' ? 'Structure for Tracker' :
             selectedTemplate?.name || 'AI Planner'}
          </span>
          <button onClick={onClose} style={styles.aiModalClose}>×</button>
        </div>

        {/* Body */}
        <div style={{...styles.aiModalBody, display: 'flex', flexDirection: 'column'}}>
          
          {/* Step 1: Select Template */}
          {step === 'select' && (
            <div>
              <p style={{ fontSize: '14px', color: theme.textMuted, marginBottom: '16px' }}>
                Choose a planning template to get started:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {planTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => { setSelectedTemplate(template); setStep('fill'); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      background: theme.bgSecondary,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>{template.icon}</span>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: theme.text }}>
                      {template.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Fill in the Blanks */}
          {step === 'fill' && selectedTemplate && (
            <div>
              <p style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '16px' }}>
                Fill in the blanks to personalize your plan:
              </p>
              <div style={{
                background: theme.bgSecondary,
                border: `1px solid ${theme.border}`,
                borderRadius: '8px',
                padding: '16px',
                fontSize: '14px',
                lineHeight: '2.2',
                color: theme.text,
              }}>
                {selectedTemplate.prompt_template.split(/(\[[^\]]+\])/).map((part, i) => {
                  const match = part.match(/^\[([^\]]+)\]$/);
                  if (match) {
                    const fieldName = match[1];
                    return (
                      <input
                        key={i}
                        type="text"
                        value={fieldValues[fieldName] || ''}
                        onChange={e => setFieldValues(prev => ({ ...prev, [fieldName]: e.target.value }))}
                        placeholder={fieldName}
                        style={{
                          width: `${Math.max(80, fieldName.length * 9)}px`,
                          padding: '4px 8px',
                          border: `1px solid ${theme.border}`,
                          borderRadius: '4px',
                          fontSize: '14px',
                          background: theme.bg,
                          color: theme.text,
                          margin: '0 2px',
                        }}
                      />
                    );
                  }
                  return <span key={i}>{part}</span>;
                })}
              </div>
            </div>
          )}

          {/* Step 3: Chat */}
          {step === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '300px' }}>
              {/* Messages */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                marginBottom: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      background: msg.role === 'user' ? theme.primary : theme.bgSecondary,
                      color: msg.role === 'user' ? '#fff' : theme.text,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.content}
                  </div>
                ))}
                {isLoading && (
                  <div style={{
                    alignSelf: 'flex-start',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: theme.bgSecondary,
                    color: theme.textMuted,
                    fontSize: '13px',
                  }}>
                    Thinking...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  padding: '10px 14px',
                  background: theme.danger + '20',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  fontSize: '13px',
                  color: theme.danger
                }}>
                  {error}
                </div>
              )}

              {/* Input */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: `1px solid ${theme.border}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: theme.bg,
                    color: theme.text,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => inputValue.trim() && sendMessage(inputValue)}
                  disabled={!inputValue.trim() || isLoading}
                  style={{
                    padding: '10px 16px',
                    background: theme.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
                    opacity: inputValue.trim() && !isLoading ? 1 : 0.5,
                    fontSize: '14px',
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Structure */}
          {step === 'structure' && structuredItems && (
            <div>
              <p style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '16px' }}>
                Select which items to create in your tracker:
              </p>

              {/* Objectives */}
              {structuredItems.objectives?.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: theme.textFaint, marginBottom: '8px', textTransform: 'uppercase' }}>
                    Objectives
                  </div>
                  {structuredItems.objectives.map((item, i) => (
                    <div
                      key={i}
                      onClick={() => toggleItem('objectives', i)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '10px 12px',
                        background: theme.bgSecondary,
                        border: `1px solid ${selectedItems.objectives.includes(i) ? theme.primary : theme.border}`,
                        borderRadius: '6px',
                        marginBottom: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        border: `2px solid ${selectedItems.objectives.includes(i) ? theme.primary : theme.border}`,
                        background: selectedItems.objectives.includes(i) ? theme.primary : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '1px',
                      }}>
                        {selectedItems.objectives.includes(i) && <span style={{ color: '#fff', fontSize: '11px' }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: theme.text }}>{item.name}</div>
                        <div style={{ fontSize: '12px', color: theme.textMuted }}>{item.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Goals */}
              {structuredItems.goals?.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: theme.textFaint, marginBottom: '8px', textTransform: 'uppercase' }}>
                    Goals (Weekly)
                  </div>
                  {structuredItems.goals.map((item, i) => (
                    <div
                      key={i}
                      onClick={() => toggleItem('goals', i)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '10px 12px',
                        background: theme.bgSecondary,
                        border: `1px solid ${selectedItems.goals.includes(i) ? theme.primary : theme.border}`,
                        borderRadius: '6px',
                        marginBottom: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        border: `2px solid ${selectedItems.goals.includes(i) ? theme.primary : theme.border}`,
                        background: selectedItems.goals.includes(i) ? theme.primary : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '1px',
                      }}>
                        {selectedItems.goals.includes(i) && <span style={{ color: '#fff', fontSize: '11px' }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: theme.text }}>
                          {item.name} <span style={{ color: theme.textMuted, fontWeight: '400' }}>({item.frequency}x/week)</span>
                        </div>
                        <div style={{ fontSize: '12px', color: theme.textMuted }}>{item.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tasks */}
              {structuredItems.tasks?.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: theme.textFaint, marginBottom: '8px', textTransform: 'uppercase' }}>
                    Tasks (One-time)
                  </div>
                  {structuredItems.tasks.map((item, i) => (
                    <div
                      key={i}
                      onClick={() => toggleItem('tasks', i)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '10px 12px',
                        background: theme.bgSecondary,
                        border: `1px solid ${selectedItems.tasks.includes(i) ? theme.primary : theme.border}`,
                        borderRadius: '6px',
                        marginBottom: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        border: `2px solid ${selectedItems.tasks.includes(i) ? theme.primary : theme.border}`,
                        background: selectedItems.tasks.includes(i) ? theme.primary : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '1px',
                      }}>
                        {selectedItems.tasks.includes(i) && <span style={{ color: '#fff', fontSize: '11px' }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: theme.text }}>{item.name}</div>
                        <div style={{ fontSize: '12px', color: theme.textMuted }}>{item.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.aiModalFooter}>
          {step === 'select' && (
            <div style={{ flex: 1 }} />
          )}

          {step === 'fill' && (
            <>
              <button onClick={() => { setStep('select'); setSelectedTemplate(null); setFieldValues({}); }} style={styles.aiBackBtn}>
                ← Back
              </button>
              <button
                onClick={startPlanning}
                disabled={!allFieldsFilled}
                style={{
                  ...styles.aiNextBtn,
                  ...(!allFieldsFilled ? styles.aiNextBtnDisabled : {}),
                }}
              >
                Start Planning →
              </button>
            </>
          )}

          {step === 'chat' && (
            <>
              <button onClick={() => setStep('fill')} style={styles.aiBackBtn}>
                ← Back
              </button>
              <button
                onClick={requestStructure}
                disabled={messages.length < 2 || isLoading}
                style={{
                  ...styles.planConvertBtn,
                  opacity: messages.length < 2 || isLoading ? 0.5 : 1,
                  cursor: messages.length < 2 || isLoading ? 'not-allowed' : 'pointer',
                }}
              >
                🎯 Structure for Tracker
              </button>
            </>
          )}

          {step === 'structure' && (
            <>
              <button onClick={() => setStep('chat')} style={styles.aiBackBtn}>
                ← Back to Chat
              </button>
              <button
                onClick={handleCreateItems}
                disabled={selectedItems.objectives.length + selectedItems.goals.length + selectedItems.tasks.length === 0}
                style={{
                  ...styles.aiNextBtn,
                  ...(selectedItems.objectives.length + selectedItems.goals.length + selectedItems.tasks.length === 0 ? styles.aiNextBtnDisabled : {}),
                }}
              >
                Create {selectedItems.objectives.length + selectedItems.goals.length + selectedItems.tasks.length} Items
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// PLAN VIEWER MODAL
// ============================================

function PlanViewerModal({ plan, onClose, onArchive, onConvert, styles, theme }) {
  const [showConvert, setShowConvert] = useState(false);
  const [createObjective, setCreateObjective] = useState(true);
  const [createGoal, setCreateGoal] = useState(true);
  const [selectedTasks, setSelectedTasks] = useState({
    grocery: true,
    mealPrep: true
  });
  
  const content = plan.content || {};
  
  const exportMarkdown = () => {
    let md = `# ${content.name || plan.name}\n\n`;
    md += `${content.summary || `${content.daily_calories} calories/day`}\n\n`;
    
    if (content.days) {
      content.days.forEach(day => {
        md += `## ${day.day}\n\n`;
        ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
          const meal = day[mealType] || day.meals?.[mealType];
          if (meal) {
            md += `### ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}: ${meal.name}\n`;
            if (meal.calories) md += `- Calories: ${meal.calories}\n`;
            if (meal.ingredients) md += `- Ingredients: ${meal.ingredients.join(', ')}\n`;
            md += '\n';
          }
        });
      });
    }
    
    if (content.shopping_list) {
      md += `## Shopping List\n\n`;
      if (Array.isArray(content.shopping_list)) {
        md += content.shopping_list.join(', ') + '\n';
      } else {
        Object.entries(content.shopping_list).forEach(([category, items]) => {
          md += `**${category}:** ${Array.isArray(items) ? items.join(', ') : items}\n\n`;
        });
      }
    }
    
    // Download
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plan.name.replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateItems = async () => {
    const items = {
      objective: createObjective ? {
        name: 'Follow meal plan',
        start_date: getToday()
      } : null,
      goal: createGoal ? {
        name: 'Stick to meal plan',
        target: 7
      } : null,
      tasks: []
    };
    
    if (selectedTasks.grocery) {
      items.tasks.push({ name: 'Week 1 grocery shopping' });
    }
    if (selectedTasks.mealPrep) {
      items.tasks.push({ name: 'Sunday meal prep' });
    }

    await onConvert(items, plan.id);
    onClose();
  };

  return (
    <div style={styles.aiModalOverlay} onClick={onClose}>
      <div style={styles.aiModal} onClick={e => e.stopPropagation()}>
        <div style={styles.aiModalHeader}>
          <span style={styles.aiModalIcon}>{showConvert ? '➡️' : '📋'}</span>
          <span style={styles.aiModalTitle}>
            {showConvert ? 'Convert to Tracker' : (content.name || plan.name)}
          </span>
          <button onClick={onClose} style={styles.aiModalClose}>×</button>
        </div>

        <div style={styles.aiModalBody}>
          {!showConvert ? (
            <div style={styles.planViewer}>
              {(content.summary || content.daily_calories) && (
                <div style={{ ...styles.planSummary, marginBottom: '16px' }}>
                  {content.summary || `${content.daily_calories} calories/day`}
                </div>
              )}

              {/* All days */}
              {content.days?.map(day => (
                <div key={day.day} style={styles.planDay}>
                  <div style={styles.planDayHeader}>{day.day}</div>
                  {['breakfast', 'lunch', 'dinner'].map(mealType => {
                    const meal = day[mealType] || day.meals?.[mealType];
                    if (!meal) return null;
                    return (
                      <div key={mealType} style={styles.planMeal}>
                        <div style={styles.planMealType}>{mealType}</div>
                        <div style={styles.planMealName}>{meal.name}</div>
                        {meal.calories && (
                          <div style={styles.planMealMeta}>{meal.calories} cal</div>
                        )}
                        {meal.ingredients && (
                          <div style={styles.planMealIngredients}>
                            {meal.ingredients.join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Shopping list */}
              {content.shopping_list && (
                <div style={styles.planSection}>
                  <div style={styles.planSectionTitle}>🛒 Shopping List</div>
                  <div style={styles.planSectionList}>
                    {Array.isArray(content.shopping_list) ? (
                      <div>{content.shopping_list.join(', ')}</div>
                    ) : (
                      Object.entries(content.shopping_list).map(([category, items]) => (
                        <div key={category} style={{ marginBottom: '8px' }}>
                          <strong>{category}:</strong> {Array.isArray(items) ? items.join(', ') : items}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '20px' }}>
                Create tracker items from this meal plan:
              </p>

              {/* Objective */}
              <div style={styles.conversionItem}>
                <div style={styles.conversionItemHeader}>
                  <span style={styles.conversionItemType}>◎ Objective</span>
                </div>
                <div style={styles.conversionItemName}>Follow meal plan</div>
                <div style={styles.conversionItemWhy}>
                  This captures your overall health goal. The meal plan will be saved for reference.
                </div>
                <div style={styles.conversionItemActions}>
                  <button
                    onClick={() => setCreateObjective(true)}
                    style={{
                      ...styles.conversionRadio,
                      ...(createObjective ? styles.conversionRadioSelected : {}),
                    }}
                  >
                    ✓ Create
                  </button>
                  <button
                    onClick={() => setCreateObjective(false)}
                    style={{
                      ...styles.conversionRadio,
                      ...(!createObjective ? styles.conversionRadioSelected : {}),
                    }}
                  >
                    Skip
                  </button>
                </div>
              </div>

              {/* Goal */}
              <div style={styles.conversionItem}>
                <div style={styles.conversionItemHeader}>
                  <span style={styles.conversionItemType}>⟳ Goal (7x/week)</span>
                </div>
                <div style={styles.conversionItemName}>Stick to meal plan</div>
                <div style={styles.conversionItemWhy}>
                  Track daily adherence to build the habit. Check off each day you follow the plan.
                </div>
                <div style={styles.conversionItemActions}>
                  <button
                    onClick={() => setCreateGoal(true)}
                    style={{
                      ...styles.conversionRadio,
                      ...(createGoal ? styles.conversionRadioSelected : {}),
                    }}
                  >
                    ✓ Create
                  </button>
                  <button
                    onClick={() => setCreateGoal(false)}
                    style={{
                      ...styles.conversionRadio,
                      ...(!createGoal ? styles.conversionRadioSelected : {}),
                    }}
                  >
                    Skip
                  </button>
                </div>
              </div>

              {/* Tasks */}
              <div style={styles.conversionItem}>
                <div style={styles.conversionItemHeader}>
                  <span style={styles.conversionItemType}>◇ Tasks (one-time)</span>
                </div>
                <div style={styles.conversionTaskList}>
                  <div style={styles.conversionTask}>
                    <div 
                      onClick={() => setSelectedTasks(prev => ({ ...prev, grocery: !prev.grocery }))}
                      style={{
                        ...styles.conversionTaskCheck,
                        ...(selectedTasks.grocery ? styles.conversionTaskCheckSelected : {}),
                      }}
                    >
                      {selectedTasks.grocery && <span style={{ color: theme.bg, fontSize: '10px' }}>✓</span>}
                    </div>
                    Week 1 grocery shopping
                  </div>
                  <div style={styles.conversionTask}>
                    <div 
                      onClick={() => setSelectedTasks(prev => ({ ...prev, mealPrep: !prev.mealPrep }))}
                      style={{
                        ...styles.conversionTaskCheck,
                        ...(selectedTasks.mealPrep ? styles.conversionTaskCheckSelected : {}),
                      }}
                    >
                      {selectedTasks.mealPrep && <span style={{ color: theme.bg, fontSize: '10px' }}>✓</span>}
                    </div>
                    Sunday meal prep
                  </div>
                </div>
              </div>

              <button onClick={handleCreateItems} style={styles.createItemsBtn}>
                Create {[createObjective, createGoal, selectedTasks.grocery, selectedTasks.mealPrep].filter(Boolean).length} Items
              </button>
            </div>
          )}
        </div>

        <div style={styles.aiModalFooter}>
          {showConvert ? (
            <button onClick={() => setShowConvert(false)} style={styles.aiBackBtn}>
              ← Back to Plan
            </button>
          ) : (
            <>
              <button onClick={() => { onArchive(plan.id); onClose(); }} style={styles.modalDeleteBtn}>
                Archive
              </button>
              <div style={{ flex: 1 }} />
              <button onClick={exportMarkdown} style={styles.aiBackBtn}>
                📥 Export
              </button>
              <button onClick={() => setShowConvert(true)} style={styles.planConvertBtn}>
                ➡️ Convert
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// CONFIRM DIALOG
// ============================================

function ConfirmDialog({ title, message, confirmText, onConfirm, onCancel, styles, theme }) {
  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={{
        ...styles.modal,
        maxWidth: '340px',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>{title}</h3>
        <p style={{ 
          fontSize: '14px', 
          color: theme.textMuted, 
          marginBottom: '20px',
          lineHeight: '1.5',
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={styles.modalCancelBtn}>Cancel</button>
          <button 
            onClick={onConfirm} 
            style={{
              ...styles.modalSaveBtn,
              background: theme.danger,
            }}
          >
            {confirmText || 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ACTIVITY LOG MODAL
// ============================================

function ActivityLogModal({ activityLog, onUndo, onClose, styles, theme }) {
  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups = {};
    activityLog.forEach(item => {
      const date = new Date(item.created_at).toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return groups;
  }, [activityLog]);

  const getActionIcon = (action) => {
    switch (action) {
      case 'check': return '✓';
      case 'uncheck': return '○';
      case 'create': return '+';
      case 'delete': return '×';
      case 'update': return '✎';
      case 'complete': return '🏆';
      case 'archive': return '📦';
      default: return '•';
    }
  };

  const getActionColor = (action, theme) => {
    switch (action) {
      case 'check': return theme.success;
      case 'uncheck': return theme.warning;
      case 'create': return theme.primary;
      case 'delete': return theme.danger;
      case 'complete': return theme.success;
      default: return theme.textMuted;
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getDescription = (item) => {
    const { action, entity_type, entity_name, metadata } = item;
    
    if (entity_type === 'entry') {
      const dateStr = metadata?.date ? new Date(metadata.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      return `${action === 'check' ? 'Checked' : 'Unchecked'} "${entity_name}" for ${dateStr}`;
    }
    
    if (action === 'create') return `Created ${entity_type} "${entity_name}"`;
    if (action === 'delete') return `Deleted ${entity_type} "${entity_name}"`;
    if (action === 'update') return `Updated ${entity_type} "${entity_name}"`;
    if (action === 'complete') return `Completed ${entity_type} "${entity_name}"`;
    if (action === 'archive') return `Archived ${entity_type} "${entity_name}"`;
    if (action === 'check') return `Checked ${entity_type} "${entity_name}"`;
    if (action === 'uncheck') return `Unchecked ${entity_type} "${entity_name}"`;
    
    return `${action} ${entity_type} "${entity_name}"`;
  };

  const canUndo = (item) => {
    // Can undo check/uncheck entries and tasks
    if (item.entity_type === 'entry' && (item.action === 'check' || item.action === 'uncheck')) return true;
    if (item.entity_type === 'task' && (item.action === 'check' || item.action === 'uncheck')) return true;
    return false;
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{
        ...styles.modal,
        maxWidth: '400px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>Activity Log</h3>
        
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          marginBottom: '16px',
          marginRight: '-10px',
          paddingRight: '10px',
        }}>
          {Object.keys(groupedActivities).length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: theme.textMuted, 
              padding: '20px',
              fontSize: '14px',
            }}>
              No activity yet
            </div>
          ) : (
            Object.entries(groupedActivities).map(([date, items]) => (
              <div key={date} style={{ marginBottom: '16px' }}>
                <div style={{ 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: theme.textMuted,
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {date}
                </div>
                {items.map(item => (
                  <div key={item.id} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '8px 0',
                    borderBottom: `1px solid ${theme.border}`,
                  }}>
                    <span style={{ 
                      fontSize: '14px',
                      color: getActionColor(item.action, theme),
                      width: '18px',
                      textAlign: 'center',
                    }}>
                      {getActionIcon(item.action)}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: theme.text }}>
                        {getDescription(item)}
                      </div>
                      <div style={{ fontSize: '11px', color: theme.textFaint }}>
                        {formatTime(item.created_at)}
                      </div>
                    </div>
                    {canUndo(item) && (
                      <button
                        onClick={() => onUndo(item)}
                        style={{
                          background: 'none',
                          border: `1px solid ${theme.border}`,
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          color: theme.textMuted,
                          cursor: 'pointer',
                        }}
                      >
                        Undo
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={styles.modalCancelBtn}>Close</button>
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
  const [streakThreshold, setStreakThreshold] = useState(
    settings.streak_threshold || '2'
  );

  const handleSave = () => {
    onSave('tracking_start_date', trackingStartDate);
    onSave('threshold_green', thresholdGreen);
    onSave('threshold_yellow', thresholdYellow);
    onSave('streak_threshold', streakThreshold);
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

        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Streak Threshold</label>
          <p style={styles.modalHint}>
            Minimum consecutive days to show 🔥 streak indicator.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              min="2"
              max="30"
              value={streakThreshold}
              onChange={e => setStreakThreshold(e.target.value)}
              style={{ ...styles.thresholdInput, width: '60px' }}
            />
            <span style={styles.modalHint}>days</span>
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
    goals, entries, objectives, tasks, plans, planTemplates, settings, activityLog, isLoaded, 
    addGoal, deleteGoal, updateGoal, toggleEntry, reorderGoals,
    saveSetting, saveObjective, deleteObjective, completeObjective,
    addTask, updateTask, toggleTaskCheck, archiveTask, deleteTask,
    savePlan, archivePlan, linkPlanItem, savePlanTemplate, deletePlanTemplate
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
  const [editingTask, setEditingTask] = useState(null);
  const [showTaskEditor, setShowTaskEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [objectivesExpanded, setObjectivesExpanded] = useState(true);
  const [plansExpanded, setPlansExpanded] = useState(true);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [goalsExpanded, setGoalsExpanded] = useState(true);
  const [expandedObjectiveId, setExpandedObjectiveId] = useState(null);
  const [trophyExpanded, setTrophyExpanded] = useState(false);
  const [completedItems, setCompletedItems] = useState([]);
  // Task add form state
  const [showTaskAdd, setShowTaskAdd] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskObjectiveId, setNewTaskObjectiveId] = useState(null);
  // AI Planner state
  const [showAIPlanner, setShowAIPlanner] = useState(false);
  const [viewingPlan, setViewingPlan] = useState(null);
  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState(null);
  
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

  // Calculate Current and Pace metrics for goals
  const goalMetrics = useMemo(() => {
    if (goals.length === 0) return { current: null, pace: null };
    
    const daysElapsed = weekDates.filter(d => d <= today).length;
    if (daysElapsed === 0) return { current: null, pace: null };
    
    // Total achieved across all goals
    const totalAchieved = goals.reduce((sum, goal) => {
      return sum + weekDates.filter(d => d <= today && entries[`${goal.id}-${d}`]).length;
    }, 0);
    
    // Total weekly target across all goals
    const totalWeeklyTarget = goals.reduce((sum, goal) => sum + (goal.target || 7), 0);
    
    // Current: total achieved / total weekly target
    const current = Math.round((totalAchieved / totalWeeklyTarget) * 100);
    
    // Pace: if you continue at current rate, where will you end?
    // (achieved / days elapsed) * 7 = projected total, then / weekly target
    const projectedTotal = (totalAchieved / daysElapsed) * 7;
    const pace = Math.round((projectedTotal / totalWeeklyTarget) * 100);
    
    return { current, pace };
  }, [goals, weekDates, today, entries]);

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

  // Handle creating items from AI plan conversion
  const handleCreateItemsFromPlan = async (items, planId) => {
    let objectiveId = null;
    
    // Handle new structure (arrays) or old structure (single items)
    const objectives = items.objectives || (items.objective ? [items.objective] : []);
    const goals = items.goals || (items.goal ? [items.goal] : []);
    const tasks = items.tasks || [];
    
    // Create objectives (use first one as the main objective for linking)
    for (const obj of objectives) {
      const objData = await saveObjective({ 
        name: obj.name, 
        start_date: obj.start_date || getToday() 
      });
      if (objData) {
        if (!objectiveId) objectiveId = objData.id; // Use first objective for linking
        if (planId) await linkPlanItem(planId, 'objective', objData.id);
      }
    }
    
    // Create goals (linked to objective if created)
    for (const goal of goals) {
      await addGoal(goal.name, goal.frequency || goal.target || 7, objectiveId);
    }
    
    // Create tasks
    for (const task of tasks) {
      await addTask(task.name, objectiveId);
    }
  };

  // Confirm delete helpers
  const confirmDeleteGoal = (goalId, goalName) => {
    setConfirmDialog({
      title: 'Delete Goal',
      message: `Are you sure you want to delete "${goalName}"? This will also delete all tracking history for this goal.`,
      confirmText: 'Delete',
      onConfirm: () => {
        deleteGoal(goalId);
        setConfirmDialog(null);
      },
    });
  };

  const confirmDeleteObjective = (objectiveId, objectiveName) => {
    setConfirmDialog({
      title: 'Delete Objective',
      message: `Are you sure you want to delete "${objectiveName}"? Goals assigned to this objective will be unlinked but not deleted.`,
      confirmText: 'Delete',
      onConfirm: () => {
        deleteObjective(objectiveId);
        setConfirmDialog(null);
      },
    });
  };

  const confirmDeleteTask = (taskId, taskName) => {
    setConfirmDialog({
      title: 'Delete Task',
      message: `Are you sure you want to delete "${taskName}"?`,
      confirmText: 'Delete',
      onConfirm: () => {
        deleteTask(taskId);
        setConfirmDialog(null);
      },
    });
  };

  const confirmArchivePlan = (planId, planName) => {
    setConfirmDialog({
      title: 'Archive Plan',
      message: `Are you sure you want to archive "${planName}"? You can find it later in archived plans.`,
      confirmText: 'Archive',
      onConfirm: () => {
        archivePlan(planId);
        setViewingPlan(null);
        setConfirmDialog(null);
      },
    });
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

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowTaskEditor(true);
  };

  const handleToggleDarkMode = () => {
    saveSetting('dark_mode', darkMode ? 'false' : 'true');
  };

  const handleAddTask = () => {
    if (newTaskName.trim()) {
      addTask(newTaskName, newTaskObjectiveId);
      setNewTaskName('');
      setNewTaskObjectiveId(null);
      setShowTaskAdd(false);
    }
  };

  const handleTaskKeyDown = (e) => {
    if (e.key === 'Enter') handleAddTask();
    if (e.key === 'Escape') {
      setShowTaskAdd(false);
      setNewTaskName('');
      setNewTaskObjectiveId(null);
    }
  };

  // Load completed items for trophy case
  useEffect(() => {
    const loadCompleted = async () => {
      try {
        const { data: completedTasks } = await supabase
          .from('tasks')
          .select('*')
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false });

        const { data: completedObjectives } = await supabase
          .from('objective')
          .select('*')
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false });

        const items = [
          ...(completedTasks || []).map(t => ({ ...t, type: 'task' })),
          ...(completedObjectives || []).map(o => ({ ...o, type: 'objective' }))
        ].sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

        setCompletedItems(items);
      } catch (err) {
        console.error('Error loading completed items:', err);
      }
    };
    
    if (isLoaded) loadCompleted();
  }, [isLoaded, tasks, objectives]);

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

      {/* AI Planner Button */}
      <button 
        onClick={() => setShowAIPlanner(true)}
        style={styles.aiPlannerBtn}
      >
        <span style={styles.aiPlannerIcon}>✨</span>
        <div style={styles.aiPlannerText}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={styles.aiPlannerTitle}>Plan with AI</span>
            <span style={{
              fontSize: '9px',
              fontWeight: '600',
              background: '#f59e0b',
              color: '#fff',
              padding: '2px 5px',
              borderRadius: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>Beta</span>
          </div>
          <div style={styles.aiPlannerSubtitle}>Get help creating a detailed plan for any goal</div>
        </div>
        <span style={styles.aiPlannerArrow}>→</span>
      </button>

      {/* Plans Section */}
      {plans.length > 0 && (
        <div style={styles.plansSection}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionHeaderLeft}>
              <button 
                onClick={() => setPlansExpanded(!plansExpanded)} 
                style={styles.collapseBtn}
              >
                {plansExpanded ? '−' : '+'}
              </button>
              <span style={styles.sectionTitle}>Plans</span>
              {!plansExpanded && (
                <span style={styles.sectionCount}>({plans.length})</span>
              )}
            </div>
          </div>
          {plansExpanded && (
            <div>
              {plans.map(plan => (
                <div 
                  key={plan.id} 
                  style={styles.planCard}
                  onClick={() => setViewingPlan(plan)}
                >
                  <span style={styles.planCardIcon}>📋</span>
                  <div style={styles.planCardInfo}>
                    <div style={styles.planCardName}>{plan.name}</div>
                    <div style={styles.planCardMeta}>
                      {plan.summary || new Date(plan.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
            {!objectivesExpanded && objectives.length > 0 && (
              <span style={styles.sectionCount}>({objectives.length})</span>
            )}
          </div>
          {objectivesExpanded && (
            <button onClick={handleAddObjective} style={styles.sectionAddBtn}>+</button>
          )}
        </div>
        {objectivesExpanded && objectives.length > 0 && (
          <div style={styles.objectivesList}>
            {objectives.map(objective => (
              <ObjectiveCard
                key={objective.id}
                objective={objective}
                goals={goals}
                entries={entries}
                weekDates={weekDates}
                today={today}
                isExpanded={expandedObjectiveId === objective.id}
                onToggle={() => setExpandedObjectiveId(
                  expandedObjectiveId === objective.id ? null : objective.id
                )}
                onEdit={handleEditObjective}
                onComplete={completeObjective}
                styles={styles}
                theme={theme}
                thresholds={thresholds}
              />
            ))}
          </div>
        )}
        {objectivesExpanded && objectives.length === 0 && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: theme.textMuted,
            fontSize: '13px',
            background: theme.bgSecondary,
            borderRadius: '8px',
          }}>
            <div style={{ marginBottom: '8px' }}>No objectives yet</div>
            <div style={{ fontSize: '12px', color: theme.textFaint }}>
              Objectives are outcomes you're working toward. Click + to create one.
            </div>
          </div>
        )}
      </div>

      {/* Tasks Section */}
      <div style={styles.tasksSection}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionHeaderLeft}>
            <button 
              onClick={() => setTasksExpanded(!tasksExpanded)} 
              style={styles.collapseBtn}
            >
              {tasksExpanded ? '−' : '+'}
            </button>
            <span style={styles.sectionTitle}>Tasks</span>
            {!tasksExpanded && tasks.length > 0 && (
              <span style={styles.sectionCount}>({tasks.length})</span>
            )}
          </div>
          {tasksExpanded && !showTaskAdd && (
            <button onClick={() => setShowTaskAdd(true)} style={styles.sectionAddBtn}>+</button>
          )}
        </div>
        
        {tasksExpanded && (
          <>
            {tasks.length > 0 && (
              <div style={styles.tasksList}>
                {tasks.map(task => {
                  const objective = objectives.find(o => o.id === task.objective_id);
                  const daysSinceStart = task.start_date ? daysBetween(task.start_date, today) : 0;
                  return (
                    <div key={task.id} style={styles.taskItem}>
                      <div 
                        onClick={() => toggleTaskCheck(task.id, !task.checked)}
                        style={{
                          ...styles.taskCheckbox,
                          ...(task.checked ? styles.taskCheckboxChecked : {}),
                        }}
                      >
                        {task.checked && <span style={styles.taskCheckmark}>✓</span>}
                      </div>
                      <span 
                        onClick={() => handleEditTask(task)}
                        style={{
                          ...styles.taskName,
                          ...(task.checked ? styles.taskNameChecked : {}),
                        }}
                      >
                        {task.name}
                      </span>
                      {objective && (
                        <span style={styles.taskObjectiveTag}>◎ {objective.name}</span>
                      )}
                      {!task.checked && daysSinceStart > 0 && (
                        <span style={styles.taskDays}>({daysSinceStart}d)</span>
                      )}
                      {task.checked && (
                        <button 
                          onClick={() => archiveTask(task.id)}
                          style={styles.taskArchiveBtn}
                        >
                          Archive
                        </button>
                      )}
                      <button 
                        onClick={() => confirmDeleteTask(task.id, task.name)}
                        style={styles.taskDeleteBtn}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {tasks.length === 0 && !showTaskAdd && (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: theme.textMuted,
                fontSize: '13px',
                background: theme.bgSecondary,
                borderRadius: '8px',
              }}>
                <div style={{ marginBottom: '8px' }}>No tasks yet</div>
                <div style={{ fontSize: '12px', color: theme.textFaint }}>
                  Tasks are one-time actions. Click + to add one.
                </div>
              </div>
            )}
            
            {showTaskAdd && (
              <div style={styles.taskAddContainer}>
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  onKeyDown={handleTaskKeyDown}
                  placeholder="New task..."
                  style={styles.taskInput}
                  autoFocus
                />
                {objectives.length > 0 && (
                  <select
                    value={newTaskObjectiveId || ''}
                    onChange={(e) => setNewTaskObjectiveId(e.target.value || null)}
                    style={styles.taskObjectiveSelect}
                  >
                    <option value="">No objective</option>
                    {objectives.map(obj => (
                      <option key={obj.id} value={obj.id}>{obj.name}</option>
                    ))}
                  </select>
                )}
                <button onClick={handleAddTask} style={styles.addBtn}>Add</button>
                <button 
                  onClick={() => { setShowTaskAdd(false); setNewTaskName(''); setNewTaskObjectiveId(null); }} 
                  style={styles.cancelBtn}
                >
                  ×
                </button>
              </div>
            )}
          </>
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
            {goals.length > 0 && (
              <>
                {!goalsExpanded && <span style={styles.sectionCount}>({goals.length})</span>}
                {goalMetrics.current !== null && (
                  <span style={styles.goalMetrics}>
                    <span style={styles.goalMetricItem}>
                      Current: <span style={{
                        color: goalMetrics.current >= thresholds.green ? theme.success :
                               goalMetrics.current >= thresholds.yellow ? theme.warning : theme.danger
                      }}>{goalMetrics.current}%</span>
                    </span>
                    <span style={styles.goalMetricItem}>
                      Pace: <span style={{
                        color: goalMetrics.pace >= thresholds.green ? theme.success :
                               goalMetrics.pace >= thresholds.yellow ? theme.warning : theme.danger
                      }}>{goalMetrics.pace}%</span>
                    </span>
                  </span>
                )}
              </>
            )}
          </div>
          {goalsExpanded && !showAddForm && (
            <button onClick={() => setShowAddForm(true)} style={styles.sectionAddBtn}>+</button>
          )}
        </div>
        
        {goalsExpanded && (
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
                      <td colSpan={9} style={{
                        ...styles.emptyRow,
                        padding: '20px',
                        textAlign: 'center',
                      }}>
                        <div style={{ marginBottom: '8px', color: theme.textMuted }}>No goals yet</div>
                        <div style={{ fontSize: '12px', color: theme.textFaint }}>
                          Goals are habits you track weekly. Click + to create one.
                        </div>
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
                            deleteGoal={(id) => confirmDeleteGoal(id, goal.name)}
                            onEdit={handleEditGoal}
                            styles={styles}
                            theme={theme}
                            thresholds={thresholds}
                            streakThreshold={parseInt(settings.streak_threshold) || 2}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                </tbody>
              </table>
            </div>
          </>
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
                  {/* Weekly totals row */}
                  {goals.length > 1 && (() => {
                    const getPctColor = (pct) => {
                      if (pct >= thresholds.green) return theme.success;
                      if (pct >= thresholds.yellow) return theme.warning;
                      return theme.danger;
                    };
                    
                    const weeklyTotals = weeksWithData.map(week => {
                      const dates = getWeekDates(week.offset);
                      let totalAchieved = 0;
                      let totalTarget = 0;
                      goals.forEach(goal => {
                        totalAchieved += dates.filter(d => entries[`${goal.id}-${d}`]).length;
                        totalTarget += goal.target || 7;
                      });
                      return totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
                    });
                    
                    const overallAvg = Math.round(weeklyTotals.reduce((a, b) => a + b, 0) / weeklyTotals.length);
                    
                    return (
                      <tr style={{ borderTop: `2px solid ${theme.border}` }}>
                        <td style={{ ...styles.tdGoalPerf, fontWeight: '600', fontSize: '12px' }}>Total</td>
                        {weeklyTotals.map((pct, i) => (
                          <td 
                            key={weeksWithData[i].offset} 
                            style={{
                              ...styles.tdPerfPct,
                              fontWeight: '600',
                              color: getPctColor(pct)
                            }}
                          >
                            {pct}%
                          </td>
                        ))}
                        <td style={{
                          ...styles.tdPerfPct,
                          fontWeight: '700',
                          color: getPctColor(overallAvg)
                        }}>
                          {overallAvg}%
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Trophy Case */}
      {completedItems.length > 0 && (
        <div style={styles.trophySection}>
          <div 
            style={styles.trophyHeader}
            onClick={() => setTrophyExpanded(!trophyExpanded)}
          >
            <span style={styles.trophyIcon}>🏆</span>
            <span style={styles.trophyTitle}>Completed</span>
            <span style={styles.trophyCount}>({completedItems.length})</span>
            <span style={styles.trophyExpandIcon}>{trophyExpanded ? '▾' : '▸'}</span>
          </div>
          
          {trophyExpanded && (
            <div style={styles.trophyList}>
              {completedItems.map(item => (
                <div key={`${item.type}-${item.id}`} style={styles.trophyItem}>
                  <span style={styles.trophyItemIcon}>
                    {item.type === 'objective' ? '◎' : '◇'}
                  </span>
                  <span style={styles.trophyItemName}>{item.name}</span>
                  <span style={styles.trophyItemDate}>
                    {new Date(item.completed_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Link */}
      <div style={styles.settingsSection}>
        <button 
          onClick={() => setShowActivityLog(true)} 
          style={styles.settingsBtn}
        >
          📋 Activity
        </button>
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
          onDelete={(id) => {
            setShowObjectiveEditor(false);
            confirmDeleteObjective(id, editingObjective?.name || 'this objective');
          }}
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
          onDelete={(id) => {
            setShowGoalEditor(false);
            confirmDeleteGoal(id, editingGoal?.name || 'this goal');
          }}
          onClose={() => setShowGoalEditor(false)}
          styles={styles}
        />
      )}

      {/* Task Editor Modal */}
      {showTaskEditor && (
        <TaskEditor
          task={editingTask}
          objectives={objectives}
          onSave={updateTask}
          onDelete={(id) => {
            setShowTaskEditor(false);
            confirmDeleteTask(id, editingTask?.name || 'this task');
          }}
          onClose={() => setShowTaskEditor(false)}
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

      {/* AI Planner Modal */}
      {showAIPlanner && (
        <AIPlannerModal
          onClose={() => setShowAIPlanner(false)}
          onSavePlan={savePlan}
          onCreateItems={handleCreateItemsFromPlan}
          planTemplates={planTemplates}
          styles={styles}
          theme={theme}
        />
      )}

      {/* Plan Viewer Modal */}
      {viewingPlan && (
        <PlanViewerModal
          plan={viewingPlan}
          onClose={() => setViewingPlan(null)}
          onArchive={(id) => confirmArchivePlan(id, viewingPlan?.name || 'this plan')}
          onConvert={handleCreateItemsFromPlan}
          styles={styles}
          theme={theme}
        />
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          styles={styles}
          theme={theme}
        />
      )}

      {/* Activity Log Modal */}
      {showActivityLog && (
        <ActivityLogModal
          activityLog={activityLog}
          onUndo={(item) => {
            // Handle undo for check/uncheck
            if (item.entity_type === 'entry') {
              toggleEntry(item.entity_id, item.metadata?.date);
            } else if (item.entity_type === 'task') {
              const task = tasks.find(t => t.id === item.entity_id);
              if (task) {
                toggleTaskCheck(item.entity_id, item.action === 'uncheck');
              }
            }
          }}
          onClose={() => setShowActivityLog(false)}
          styles={styles}
          theme={theme}
        />
      )}
    </div>
  );
}

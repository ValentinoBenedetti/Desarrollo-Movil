import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, Pressable, FlatList, 
  StyleSheet, Alert, LayoutAnimation, Platform, UIManager 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task, TaskItem } from '../components/TaskItem';

// Configurar LayoutAnimation para Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Filter = 'Todas' | 'Activas' | 'Completadas';
const STORAGE_KEY = '@todo_list';

export default function ToDoScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputText, setInputText] = useState('');
  const [filter, setFilter] = useState<Filter>('Todas');

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const loadTasks = async () => {
    try {
      const storedTasks = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedTasks) setTasks(JSON.parse(storedTasks));
    } catch (e) {
      console.error("Error cargando tareas:", e);
    }
  };

  const saveTasks = async (tasksToSave: Task[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasksToSave));
    } catch (e) {
      console.error("Error guardando tareas:", e);
    }
  };

  const handleAddTask = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev => [
      ...prev,
      { id: Date.now().toString(), title: trimmed, completed: false }
    ]);
    setInputText('');
  };

  const handleToggleTask = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
  };

  const handleEditTask = (id: string, newTitle: string) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, title: newTitle } : t
    ));
  };

  const handleDeleteTask = (id: string) => {
    Alert.alert(
      "Eliminar tarea",
      "¿Estás seguro de que deseas eliminar esta tarea?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive",
          onPress: () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setTasks(prev => prev.filter(t => t.id !== id));
          }
        }
      ]
    );
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'Activas') return !t.completed;
    if (filter === 'Completadas') return t.completed;
    return true;
  });

  const totalCount = tasks.length;
  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Mis Tareas</Text>
      <Text style={styles.counter}>
        Total: {totalCount} | Completadas: {completedCount}
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Añadir nueva tarea..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleAddTask}
        />
        <Pressable style={styles.addButton} onPress={handleAddTask}>
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </View>

      <View style={styles.filterContainer}>
        {(['Todas', 'Activas', 'Completadas'] as Filter[]).map(f => (
          <Pressable 
            key={f} 
            onPress={() => setFilter(f)}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filteredTasks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TaskItem 
            task={item} 
            onToggle={handleToggleTask} 
            onDelete={handleDeleteTask} 
            onEdit={handleEditTask}
          />
        )}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
    paddingTop: 40,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  counter: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginRight: 8,
  },
  addButton: {
    width: 48,
    height: 48,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterButtonActive: {
    borderBottomColor: '#2196F3',
  },
  filterText: {
    color: '#666',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#2196F3',
  },
  listContent: {
    paddingBottom: 20,
  }
});


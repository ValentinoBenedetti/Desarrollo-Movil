import React, { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';

export interface Task {
  id: string;
  title: string;
  completed: boolean;
}

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newTitle: string) => void;
}

export const TaskItem = ({ task, onToggle, onDelete, onEdit }: TaskItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const lastTapRef = useRef<number>(0);

  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    
    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      // Es un doble tap
      setIsEditing(true);
      // Cancelamos el toggle del primer tap (opcional, pero útil)
      onToggle(task.id); 
    } else {
      // Es un tap normal (puede ser el primero de un doble tap)
      lastTapRef.current = now;
      onToggle(task.id);
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    if (editTitle.trim() !== '') {
      onEdit(task.id, editTitle.trim());
    } else {
      setEditTitle(task.title); // restaurar si está vacío
    }
  };

  return (
    <Pressable 
      onPress={handlePress}
      onLongPress={() => onDelete(task.id)}
      style={({ pressed }) => [
        styles.container,
        { opacity: pressed && !isEditing ? 0.7 : 1 }
      ]}
    >
      <View style={[styles.checkbox, task.completed && styles.checkboxCompleted]}>
        {task.completed && <Text style={styles.checkText}>✓</Text>}
      </View>
      
      {isEditing ? (
        <TextInput
          style={styles.input}
          value={editTitle}
          onChangeText={setEditTitle}
          onBlur={handleSave}
          onSubmitEditing={handleSave}
          autoFocus
        />
      ) : (
        <Text style={[styles.title, task.completed && styles.titleCompleted]}>
          {task.title}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 12,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#2196F3',
  },
  checkText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#2196F3',
  }
});


import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface AuthContainerProps {
  title: string;
  headerTitle: string;
  headerSubtitle: string;
  children: React.ReactNode;
  showBackButton?: boolean;
}

export function AuthContainer({ title, headerTitle, headerSubtitle, children, showBackButton = true }: AuthContainerProps) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          {/* Top Blue Section */}
          <View style={styles.topSection}>
            <View style={styles.appBar}>
              {showBackButton ? (
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                  <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                  <Text style={styles.backText}>{title}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.backButton}>
                  <Text style={styles.backText}>{title}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Bottom White Card */}
          <View style={styles.cardSection}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>{headerTitle}</Text>
              <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
            </View>
            
            <View style={styles.formContainer}>
              {children}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#281C9D', // Azul oscuro de fondo principal
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  topSection: {
    height: 120, // Espacio superior azul
    backgroundColor: '#281C9D',
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingTop: 20,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    marginLeft: 8,
  },
  cardSection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  headerTextContainer: {
    marginBottom: 32,
  },
  headerTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 24,
    color: '#281C9D', // Azul de títulos según Figma
    marginBottom: 8,
  },
  headerSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#343434',
  },
  formContainer: {
    flex: 1,
  },
});

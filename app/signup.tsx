import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for auto-focus
  const passwordInputRef = useRef<TextInput>(null);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.8)).current;
  const logoRotateAnim = useRef(new Animated.Value(0)).current;
  const emailBorderAnim = useRef(new Animated.Value(0)).current;
  const passwordBorderAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const errorOpacityAnim = useRef(new Animated.Value(0)).current;
  const passwordErrorOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Smooth, elegant entrance animation with logo
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: true,
      }),
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle logo rotation animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoRotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoRotateAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Animate input borders on focus
  useEffect(() => {
    Animated.timing(emailBorderAnim, {
      toValue: emailFocused ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
    
    if (emailFocused) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [emailFocused]);

  useEffect(() => {
    Animated.timing(passwordBorderAnim, {
      toValue: passwordFocused ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
    
    if (passwordFocused) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [passwordFocused]);

  // Animate error messages
  useEffect(() => {
    if (error) {
      Animated.timing(errorOpacityAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      errorOpacityAnim.setValue(0);
    }
  }, [error]);

  const validatePassword = (pwd: string) => {
    if (pwd.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return null;
  };

  const passwordError = password ? validatePassword(password) : null;

  useEffect(() => {
    if (passwordError) {
      Animated.timing(passwordErrorOpacityAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      passwordErrorOpacityAnim.setValue(0);
    }
  }, [passwordError]);

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const passwordErrorMsg = validatePassword(password);
    if (passwordErrorMsg) {
      setError(passwordErrorMsg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setError(null);
    setIsSigningUp(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const result = await signUp(email.trim(), password);
    setIsSigningUp(false);

    if (result.error) {
      const signUpError = result.error;
      let errorMessage = signUpError.message || 'Please try again';
      
      if (signUpError.message?.includes('invalid') || signUpError.message?.includes('Invalid email')) {
        errorMessage = 'Please use a valid email address (e.g., yourname@gmail.com)';
      } else if (signUpError.message?.includes('already registered') || signUpError.message?.includes('already exists')) {
        errorMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (signUpError.message?.includes('Password')) {
        errorMessage = 'Password does not meet requirements. Please use a stronger password.';
      }
      
      setError(errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const data = (result as any).data;
      if (data?.user && !data.session) {
        // Email confirmation required - handled by router redirect
        router.replace('/login');
      } else {
        // Account created - redirect to login
        router.replace('/login');
      }
    }
  };

  const handleButtonPress = () => {
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.96,
        duration: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
    handleSignUp();
  };

  const handleShowPassword = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPassword(!showPassword);
  };

  const emailBorderColor = emailBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#e5e7eb', '#b38f5b'],
  });

  const passwordBorderColor = passwordBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#e5e7eb', '#b38f5b'],
  });

  const logoRotation = logoRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-2deg', '2deg'],
  });

  const isFormValid = email.trim() && password.trim() && !passwordError;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#ffffff' }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Math.max(insets.top + 20, 60),
          paddingBottom: Math.max(insets.bottom + 40, 60),
          paddingHorizontal: 28,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={{ 
            flex: 1, 
            justifyContent: 'center', 
            maxWidth: 400, 
            width: '100%', 
            alignSelf: 'center',
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Logo/Icon - Apple-style minimal branding with subtle animation */}
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <Animated.View
              style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                backgroundColor: '#b38f5b',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 24,
                shadowColor: '#b38f5b',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 20,
                elevation: 8,
                transform: [
                  { scale: logoScaleAnim },
                  { rotate: logoRotation },
                ],
              }}
            >
              <Text style={{ fontSize: 40, fontWeight: '600', color: '#ffffff', letterSpacing: -1 }}>
                S
              </Text>
            </Animated.View>
          </View>

          {/* Title Section - Apple's signature large, clear typography */}
          <View style={{ marginBottom: 40 }}>
            <Text
              style={{
                fontSize: 34,
                fontWeight: '700',
                color: '#000000',
                letterSpacing: -0.5,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              Create Account
            </Text>
            <Text
              style={{
                fontSize: 17,
                fontWeight: '400',
                color: '#6b7280',
                letterSpacing: -0.2,
                lineHeight: 24,
                textAlign: 'center',
              }}
            >
              Start organizing your photos with AI-powered tagging
            </Text>
          </View>

          {/* Form - Clean, focused inputs */}
          <View style={{ marginBottom: 24 }}>
            {/* Email Input */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#374151',
                  letterSpacing: -0.1,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                }}
              >
                Email
              </Text>
              <Animated.View
                style={{
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: emailBorderColor,
                  backgroundColor: emailFocused ? '#ffffff' : '#f9fafb',
                  overflow: 'hidden',
                }}
              >
                <TextInput
                  placeholder="you@example.com"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType="next"
                  editable={!isSigningUp}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  onSubmitEditing={() => {
                    passwordInputRef.current?.focus();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{
                    fontSize: 17,
                    fontWeight: '400',
                    color: '#111827',
                    letterSpacing: -0.2,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}
                />
              </Animated.View>
            </View>

            {/* Password Input */}
            <View style={{ marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#374151',
                  letterSpacing: -0.1,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                }}
              >
                Password
              </Text>
              <Animated.View
                style={{
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: passwordBorderColor,
                  backgroundColor: passwordFocused ? '#ffffff' : '#f9fafb',
                  overflow: 'hidden',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <TextInput
                  ref={passwordInputRef}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password-new"
                  returnKeyType="done"
                  editable={!isSigningUp}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  onSubmitEditing={handleSignUp}
                  style={{
                    flex: 1,
                    fontSize: 17,
                    fontWeight: '400',
                    color: '#111827',
                    letterSpacing: -0.2,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}
                />
                <TouchableOpacity
                  onPress={handleShowPassword}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}
                  activeOpacity={0.6}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '500',
                      color: '#6b7280',
                      letterSpacing: -0.1,
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
              {passwordError && (
                <Animated.View
                  style={{
                    opacity: passwordErrorOpacityAnim,
                    marginTop: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '400',
                      color: '#ef4444',
                      letterSpacing: -0.1,
                    }}
                  >
                    {passwordError}
                  </Text>
                </Animated.View>
              )}
            </View>

            {/* Error Message - Inline, elegant */}
            {error && (
              <Animated.View
                style={{
                  opacity: errorOpacityAnim,
                  marginTop: 12,
                  paddingHorizontal: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: '#ef4444',
                    letterSpacing: -0.1,
                  }}
                >
                  {error}
                </Text>
              </Animated.View>
            )}
          </View>

          {/* Sign Up Button - Apple-style prominent primary action */}
          <Animated.View
            style={{
              transform: [{ scale: buttonScaleAnim }],
            }}
          >
            <TouchableOpacity
              onPress={handleButtonPress}
              disabled={isSigningUp || authLoading || !isFormValid}
              activeOpacity={1}
              style={{
                width: '100%',
                borderRadius: 12,
                paddingVertical: 16,
                backgroundColor: isFormValid && !isSigningUp ? '#b38f5b' : '#e5e7eb',
                shadowColor: isFormValid && !isSigningUp ? '#b38f5b' : 'transparent',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: isFormValid && !isSigningUp ? 4 : 0,
                marginBottom: 24,
              }}
            >
              {isSigningUp ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 10 }} />
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: '600',
                      color: '#ffffff',
                      letterSpacing: -0.2,
                    }}
                  >
                    Creating Account...
                  </Text>
                </View>
              ) : (
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '600',
                    color: isFormValid ? '#ffffff' : '#9ca3af',
                    letterSpacing: -0.2,
                    textAlign: 'center',
                  }}
                >
                  Create Account
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Sign In Link - Subtle, Apple-style secondary action */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/login');
            }}
            style={{ alignItems: 'center', paddingVertical: 12 }}
            activeOpacity={0.6}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '400',
                color: '#6b7280',
                letterSpacing: -0.1,
              }}
            >
              Already have an account?{' '}
              <Text
                style={{
                  fontWeight: '600',
                  color: '#b38f5b',
                }}
              >
                Sign In
              </Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

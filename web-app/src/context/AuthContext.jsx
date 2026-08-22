import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // متابعة حالة تسجيل الدخول + قراءة صلاحية الأدمن من الـ Custom Claim
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const token = await user.getIdTokenResult();
          setIsAdmin(token.claims.admin === true);
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // متابعة مستند الطالب في Firestore بشكل لحظي (لتحديث حالة الاشتراك فور التفعيل)
  useEffect(() => {
    if (!firebaseUser) return undefined;
    const unsub = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setProfile(null)
    );
    return unsub;
  }, [firebaseUser]);

  const value = useMemo(
    () => ({
      user: firebaseUser,
      profile,
      isAdmin,
      loading,

      async register({ fullName, phone, email, password, grade }) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await setDoc(doc(db, 'users', cred.user.uid), {
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          grade: (grade || '').trim(),
          role: 'student',
          subscriptions: {},
          createdAt: serverTimestamp(),
        });
        return cred.user;
      },

      login: (email, password) => signInWithEmailAndPassword(auth, email.trim(), password),

      logout: () => signOut(auth),

      resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),

      async updateProfileInfo({ fullName, phone, grade }) {
        const uid = auth.currentUser.uid;
        await updateDoc(doc(db, 'users', uid), {
          fullName: fullName.trim(),
          phone: phone.trim(),
          grade: (grade || '').trim(),
          updatedAt: serverTimestamp(),
        });
        // مزامنة الاسم والصف مع لوحة الأبطال (المستند موجود فقط بعد أول اختبار)
        await updateDoc(doc(db, 'leaderboard', uid), {
          fullName: fullName.trim(),
          grade: (grade || '').trim(),
        }).catch(() => {});
      },

      async changePassword(currentPassword, newPassword) {
        const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, cred);
        await updatePassword(auth.currentUser, newPassword);
      },

      /** حالة اشتراك الطالب في مادة معيّنة */
      subscriptionOf(subjectId) {
        const sub = profile?.subscriptions?.[subjectId];
        if (!sub) return { status: 'none' };
        if (
          sub.status === 'active' &&
          sub.expiresAt &&
          sub.expiresAt.toMillis &&
          sub.expiresAt.toMillis() < Date.now()
        ) {
          return { ...sub, status: 'expired' };
        }
        return sub;
      },
    }),
    [firebaseUser, profile, isAdmin, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth يجب أن يُستخدم داخل AuthProvider');
  return ctx;
}

export { onAuthStateChanged };

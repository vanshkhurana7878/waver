importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAFZJJuzNYu4PzcUPmAhF1KRYjENAy-aU4",
  authDomain: "waver-503205.firebaseapp.com",
  projectId: "waver-503205",
  storageBucket: "waver-503205.firebasestorage.app",
  messagingSenderId: "1060032405440",
  appId: "1:1060032405440:web:c4586e5a730154222f3225"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/logo.png"
  });
});
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getMessaging,
  getToken,
  onmessage
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging.js";

const firebaseConfig = {
 apiKey: "AIzaSyAFZJJuzNYu4PzcUPmAhF1KRYjENAy-aU4",
  authDomain: "waver-503205.firebaseapp.com",
  projectId: "waver-503205",
  storageBucket: "waver-503205.firebasestorage.app",
  messagingSenderId: "1060032405440",
  appId: "1:1060032405440:web:c4586e5a730154222f3225"
  
  
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

async function requestPermission() {
  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    const token = await getToken(messaging, {
      vapidKey: "BO-YHD22eh7VQfDcd-QOwAB-78zo-ObGgrI6MaCLMZdDtTn5To-PkM4kYqeVd-rsL9MoWhhe3YHL-bVj530yy7s"
    });

    console.log("FCM Token:", token);
const tokenAuth = localStorage.getItem("access_token");

const response = await fetch("/api/me", {
    headers: {
        Authorization: "Bearer " + tokenAuth
    }
});

const result = await response.json();

const email = result.user.email;

await fetch("/save-fcm-token", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        email,
        fcm_token: token
    })
});

console.log("FCM Token Saved");
    // Agle step me is token ko server par bhejenge
  } else {
    console.log("Notification permission denied");
  }
}

requestPermission();
// Foreground notification
onMessage(messaging, (payload) => {

    console.log("Foreground Notification:", payload);

    if (Notification.permission === "granted") {

        new Notification(
            payload.notification.title,
            {
                body: payload.notification.body,
                icon: payload.notification.icon || "/images/waver.png"
            }
        );

    }

});
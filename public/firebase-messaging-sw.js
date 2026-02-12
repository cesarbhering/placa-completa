importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyA4U1Pzbw_7Bln3-m_yTOUETgZHXwE43Ko",
  authDomain: "placacompleta.firebaseapp.com",
  projectId: "placacompleta",
  storageBucket: "placacompleta.firebasestorage.app",
  messagingSenderId: "863649566544",
  appId: "1:863649566544:web:0bbe76a74d57865891a655"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload)

  const notificationTitle = payload.notification.title || 'PlacaCompleta'
  const notificationOptions = {
    body: payload.notification.body || 'Nova notificação',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png'
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

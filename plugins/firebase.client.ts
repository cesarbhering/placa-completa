import { initializeApp } from 'firebase/app'
import { getMessaging } from 'firebase/messaging'

export default defineNuxtPlugin(() => {
  const firebaseConfig = {
    apiKey: "AIzaSyA4U1Pzbw_7Bln3-m_yTOUETgZHXwE43Ko",
    authDomain: "placacompleta.firebaseapp.com",
    projectId: "placacompleta",
    storageBucket: "placacompleta.firebasestorage.app",
    messagingSenderId: "863649566544",
    appId: "1:863649566544:web:0bbe76a74d57865891a655"
  }

  const app = initializeApp(firebaseConfig)
  const messaging = getMessaging(app)

  return {
    provide: {
      firebase: app,
      messaging
    }
  }
})

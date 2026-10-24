import { createApp, h } from 'vue'
import { createRouter, createWebHashHistory, RouterView } from 'vue-router'
import App from './App.vue'
import './style.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: App },
    { path: '/formulier', component: () => import('./views/OnlineFormView.vue') },
    { path: '/print', component: () => import('./views/PrintView.vue') },
    { path: '/beheer/:tab?', component: () => import('./admin/AdminView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

createApp({ render: () => h(RouterView) }).use(router).mount('#app')

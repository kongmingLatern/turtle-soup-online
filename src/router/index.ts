import { createRouter, createWebHashHistory } from 'vue-router'

import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
	{
		path: '/',
		name: 'home',
		component: () => import('@/pages/CommonIndex.vue'),
	},
	{
		path: '/big-screen',
		name: 'big-screen',
		component: () => import('@/pages/BigScreen.vue'),
	},
]

export const router = createRouter({
	history: createWebHashHistory(),
	routes,
})

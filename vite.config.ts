import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import path from 'path'
import vue from '@vitejs/plugin-vue'

const elementPlusComponentDirs: Record<string, string> = {
	ElAvatar: 'avatar',
	ElButton: 'button',
	ElCheckbox: 'checkbox',
	ElColorPicker: 'color-picker',
	ElConfigProvider: 'config-provider',
	ElDialog: 'dialog',
	ElDrawer: 'drawer',
	ElDropdown: 'dropdown',
	ElDropdownItem: 'dropdown',
	ElDropdownMenu: 'dropdown',
	ElEmpty: 'empty',
	ElForm: 'form',
	ElFormItem: 'form',
	ElInput: 'input',
	ElOption: 'select',
	ElPopover: 'popover',
	ElRadio: 'radio',
	ElRadioButton: 'radio',
	ElRadioGroup: 'radio',
	ElRate: 'rate',
	ElSegmented: 'segmented',
	ElSelect: 'select',
	ElSlider: 'slider',
	ElSwitch: 'switch',
	ElTabPane: 'tabs',
	ElTabs: 'tabs',
	ElTag: 'tag',
	ElTooltip: 'tooltip',
	ElUpload: 'upload',
}

function ElementPlusDirectResolver() {
	return {
		type: 'component' as const,
		resolve(name: string) {
			const dir = elementPlusComponentDirs[name]
			if (!dir) return undefined
			return {
				name,
				from: `element-plus/es/components/${dir}/index.mjs`,
				sideEffects: [
					'element-plus/es/components/base/style/css',
					`element-plus/es/components/${dir}/style/css`,
				],
			}
		},
	}
}

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		Components({
			resolvers: [ElementPlusDirectResolver()],
		}),
	],
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (!id.includes('node_modules')) return undefined
					if (id.includes('/element-plus/')) return 'element-plus'
					if (id.includes('/@element-plus/icons-vue/')) return 'element-icons'
					if (id.includes('/socket.io-client/') || id.includes('/engine.io-client/')) {
						return 'socket-vendor'
					}
					return 'vendor'
				},
			},
		},
	},
	server: {
		port: 5555,
		proxy: {
			'^/api': {
				target: 'http://localhost:3001/api', // 将要代理的目标地址
				changeOrigin: true, // 是否改变源地址
				rewrite: path => path.replace('/api', ''),
			},
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},
})

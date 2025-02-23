import Vue from 'vue'
import VueI18n from 'vue-i18n'
import messages from '@/assets/lang'
Vue.use(VueI18n)

const i18n = new VueI18n({
    // Define defalut language
    locale: localStorage.getItem('lang') || 'en',

    messages
})

export default i18n

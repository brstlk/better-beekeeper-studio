import _ from 'lodash'
import { Module } from "vuex";
import rawLog from '@bksLogger'
import { State as RootState } from '../index'
import { CloudError } from '@/lib/cloud/ClientHelpers';
import { TransportLicenseKey } from '@/common/transport';
import Vue from "vue"
import { LicenseStatus } from '@/lib/license';
import { SmartLocalStorage } from '@/common/LocalStorage';
import { CloudClient } from '@/lib/cloud/CloudClient';

interface State {
  initialized: boolean
  licenses: TransportLicenseKey[]
  error: CloudError | Error | null
  now: Date
  status: LicenseStatus,
}

const log = rawLog.scope('LicenseModule')

const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds

const defaultStatus = new LicenseStatus()
Object.assign(defaultStatus, {
  edition: "community",
  condition: "initial",
})

export const LicenseModule: Module<State, RootState>  = {
  namespaced: true,
  state: () => ({
    initialized: false,
    licenses: [],
    error: null,
    now: new Date(),
    status: defaultStatus,
  }),
  getters: {
    trialLicense(state) {
      return state.licenses.find((l) => l.licenseType === 'TrialLicense')
    },
    realLicenses(state) {
      return state.licenses.filter((l) => l.licenseType !== 'TrialLicense')
    },
    licenseDaysLeft(state) {
      const validUntil = state.status.license.validUntil.getTime()
      const now = state.now.getTime()
      return Math.round((validUntil - now) / oneDay);
    },
    noLicensesFound(state) {
      return state.licenses.length === 0
    },
    isUltimate(state) {
      if (!state) return false
      return state.status.isUltimate
    },
    isCommunity(state) {
      if (!state) return true
      return state.status.isCommunity
    },
    isTrial(state) {
      if (!state) return true
      return state.status.isTrial
    },
    isValidStateExpired(state) {
      // this means a license with lifetime perms, but is no longer valid for software updates
      // so the user has to use an older version of the app.
      return state.status.isValidDateExpired
    }
  },
  mutations: {
    set(state, licenses: TransportLicenseKey[]) {
      state.licenses = licenses
    },
    setInitialized(state, b: boolean) {
      state.initialized = b
    },
    setNow(state, date: Date) {
      state.now = date
    },
    setStatus(state, status: LicenseStatus) {
      state.status = status
    },
  },
  actions: {
    async init(context) {
      if (context.state.initialized) {
        log.warn('Already initialized')
        return
      }
      await context.dispatch('sync')
      context.commit('setInitialized', true)
    },
    async add(context, { email, key, trial }) {
      if (trial) {
        try {
          await Vue.prototype.$util.send('license/createTrialLicense')
          await Vue.prototype.$noty.info("Your 14 day free trial has started, enjoy!")
        } catch (error) {
          log.error("Failed to create trial license", error)
          await Vue.prototype.$noty.error("Unable to start trial: a license already exists")
          return
        }
      } else {
        const result = await CloudClient.getLicense(
          window.platformInfo.cloudUrl,
          email,
          key,
          "",
          window.platformInfo
        );

        // if we got here, license is good.
        const license = {} as TransportLicenseKey;
        license.key = key;
        license.email = email;
        license.validUntil = new Date(result.validUntil);
        license.supportUntil = new Date(result.supportUntil);
        license.maxAllowedAppRelease = result.maxAllowedAppRelease;
        license.licenseType = result.licenseType;
        await Vue.prototype.$util.send('appdb/license/save', { obj: license });
      }
      // allow emitting expired license events next time
      SmartLocalStorage.setBool('expiredLicenseEventsEmitted', false)
      await context.dispatch('sync')
    },
    async updateAll(context) {
      // License validation stubbed out: skip the network poll entirely and
      // just refresh local state from the (stubbed) status handler.
      await context.dispatch('sync');
    },
    async remove(context, license) {
      await Vue.prototype.$util.send('license/remove', { id: license.id })
      await context.dispatch('sync')
      if (context.getters.isCommunity && context.rootState.workspaceId !== -1) {
        context.commit('workspaceId', -1, { root: true })
      }
    },
    async sync(context) {
      const status = await Vue.prototype.$util.send('license/getStatus')
      const licenses = await Vue.prototype.$util.send('license/get')
      context.commit('set', licenses)
      context.commit('setStatus', status)
      context.commit('setNow', new Date())
    },
  }
}

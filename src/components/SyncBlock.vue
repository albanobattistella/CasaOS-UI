<!--
 * @Author: JerryK
 * @Date: 2021-11-10 17:48:25
 * @LastEditors: JerryK
 * @LastEditTime: 2021-12-09 15:37:37
 * @Description: 
 * @FilePath: /CasaOS-UI/src/components/SyncBlock.vue
-->
<template>
  <div class="column is-one-half">
    <div class="wuji-card">
      <!-- Init State Start -->
      <template v-if="state == 1">
        <h6 class="title is-6 mb-2 has-text-white">{{$t(`Sync your data`)}}</h6>
        <div class="is-flex is-align-items-center">
          <div class="info ">
            <div class="des two-line">
              {{$t(`Follow the guide to start syncing your files across multiple devices.`)}}
            </div>
          </div>
          <b-image :src="require('@/assets/img/sync_icon.png')" class="is-64x64"></b-image>
        </div>
        <div class="buttons">
          <b-button type="is-primary" size="is-small" rounded @click="openSyncPanel">{{$t(`Go !`)}}</b-button>
        </div>
      </template>
      <!-- Init State End -->

      <!-- Status State Start -->
      <template v-if="state == 2">
        <div class="is-flex is-align-items-center">
          <div class="flex1">
            <h6 class="title is-6 mb-2 has-text-white">{{$t(`Sync your data`)}}</h6>
          </div>
          <div class="is-flex is-align-items-center">
            <b-tooltip :label="$t('Add New Device')" position="is-top" type="is-dark">
              <button type="button" class="icon-button-new mdi mdi-plus" @click="openSyncPanel" />
            </b-tooltip>
            <b-tooltip :label="$t('Config')" position="is-top" type="is-dark">
              <button type="button" class="icon-button-new mdi mdi-cog-outline" @click="gotoAdvancedPanel" />
            </b-tooltip>
          </div>
        </div>

        <div class="columns mb-0 mt-2 is-mobile">
          <div class="column is-flex  is-align-items-center">
            <b-image :src="require('@/assets/img/device.png')" class="is-32x32"></b-image>
            <div class="flex1">
              <p class="is-size-65 ml-2 one-line">{{ $t('Up to Date') }} {{activeDevice}}/{{totalDevice}}</p>
            </div>
          </div>
          <div class="column is-flex  is-align-items-center">
            <b-image :src="require('@/assets/img/folder1.png')" class="is-32x32"></b-image>
            <div class="flex1">
              <p class="is-size-65 ml-2 one-line">{{ $t('Up to Date') }} {{activeFolders.length}}/{{folders}}</p>
            </div>
          </div>
        </div>

        <div class="columns mb-0 mt-1 is-mobile">
          <div class="column pt-0 pb-0 is-flex  is-align-items-center is-size-65">
            <b-icon :icon="syncIcon" class="mr-1" type="is-success" custom-size="mdi-18px" :custom-class="spinner"></b-icon>
            {{ $t(syncState) }}
          </div>
          <div class="column pt-0 pb-0 is-flex  is-align-items-center is-size-65 is-justify-content-end ">
            <b class="one-line" v-if="syncState == 'Synchronized'">{{ $t('Total') }}：{{totalSize | renderSize}}</b>
            <p class="one-line is-flex  is-align-items-center" v-if="syncState == 'Synchronizing'">
              <b-icon icon="cloud-upload-outline" class="mr-1" custom-size="mdi-18px"></b-icon>
              {{upSpeed | renderBps}}
              <b-icon icon="cloud-download-outline" class="ml-2 mr-1" custom-size="mdi-18px"></b-icon>
              {{downSpeed | renderBps}}
            </p>
          </div>
        </div>

      </template>
      <!-- Status State End -->

    </div>
  </div>
</template>

<script>
import SyncPanel from './SyncPanel.vue'
import forEach from 'lodash/forEach';
import pull from 'lodash/pull';
import axios from 'axios'

export default {
  name: "sync-block",
  components: {

  },
  data() {
    return {
      isLoading: false,
      timeGap: 3,
      state: 1,
      timer: 0,
      connection: {},
      total: {},
      devices: [],
      totalDevice: 0,
      activeDevice: 0,
      folders: 0,
      activeFolders: [],
      syncState: "Synchronized",
      upSpeed: 0,
      downSpeed: 0,
      myID: "",
      totalSize: 0,
      syncXhr: Object,
      syncBaseURL: ""
    }
  },
  created() {
    this.syncBaseURL = (process.env.NODE_ENV === "'dev'") ? `http://${this.$store.state.devIp}:${this.$store.state.syncthingPort}` : `${document.location.protocol}//${document.location.hostname}:${this.$store.state.syncthingPort}`
    this.syncXhr = axios.create({
      baseURL: this.syncBaseURL
    });
    this.syncXhr.defaults.headers.common['X-API-Key'] = this.$store.state.syncthingKey;
  },

  computed: {
    syncIcon() {
      return this.syncState == "Synchronized" ? "check-circle" : "sync"
    },
    spinner() {
      return this.syncState == "Synchronized" ? "" : "spinner"
    }
  },

  mounted() {
    if (this.timer) {
      clearInterval(this.timer)
    }

    // Get Events
    this.syncXhr.get(`/rest/events?limit=1`).then(res => {
      let lastEvent = res.data[0]
      this.getFolderCompletion(res)
      this.getEvents(lastEvent.id);
    })

    this.init();
    this.timer = setInterval(() => {
      this.init();
    }, this.timeGap * 1000);

  },
  destroyed() {
    clearInterval(this.timer);
  },
  watch: {
    total(newValue, oldValue) {
      if (oldValue.outBytesTotal !== undefined) {
        this.upSpeed = (newValue.outBytesTotal - oldValue.outBytesTotal) / this.timeGap
        this.downSpeed = (newValue.inBytesTotal - oldValue.inBytesTotal) / this.timeGap
      }
    }
  },

  methods: {
    init() {
      this.getStatus();
      this.getConnections();
      this.getConfigs();
      this.getTotalSize();
    },

    openSyncPanel() {
      this.$buefy.modal.open({
        parent: this,
        component: SyncPanel,
        hasModalCard: true,
        customClass: 'sync-panel',
        trapFocus: true,
        canCancel: ['escape'],
        scroll: "keep",
        animation: "zoom-out",
        events: {
          'updateConfig': () => {
            this.init(true);
          }
        },
      })
    },
    //Events Long polling 
    getEvents(id) {
      let _this = this

      this.syncXhr.get(`/rest/events?since=${id}`, { timeout: 60000 })
        .then((response) => {
          this.getFolderCompletion(response)
          id = Number(response.data[0].id) + 1
          _this.getEvents(id)
        })
        .catch((error) => {
          console.log(error.message);
          if (error.message.includes('timeout') || error.message.includes('Cannot')) {
            _this.getEvents(id)
          }

        });
    },
    getFolderCompletion(response) {
      response.data.forEach(eventData => {
        if (eventData.type == "FolderSummary") {
          if (eventData.data.summary.state == "syncing") {
            this.syncState = "Synchronizing"
            pull(this.activeFolders, eventData.data.folder);
          } else if (eventData.data.summary.state == "idle") {
            this.syncState = "Synchronized"
            if (this.activeFolders.indexOf(eventData.data.folder) == -1) {
              this.activeFolders.push(eventData.data.folder)
            }

          }
        }

        // if (eventData.type == "FolderCompletion") {
        //   console.log(eventData.data);
        // }
      })
    },
    getStatus() {
      this.syncXhr.get(`/rest/system/status`).then(res => {
        // console.log('status', res.data);
        this.myID = res.data.myID
      })
    },
    getTotalSize() {
      this.syncXhr.get(`/rest/db/completion?device=${this.myID}`).then(res => {
        this.totalSize = res.data.globalBytes
      })
    },
    getConnections() {
      this.syncXhr.get(`/rest/system/connections`).then(res => {

        this.total = res.data.total
        //console.log("connection", res.data);
        this.totalDevice = 0
        this.activeDevice = 0
        forEach(res.data.connections, (value, key) => {
          if (key != this.myID) {
            this.totalDevice++;
          }
          if (key != this.myID && value.connected) {
            this.activeDevice++;
          }
        })
      })
    },
    getConfigs() {
      this.syncXhr.get(`/rest/config`).then(res => {
        this.state = (res.data.devices.length > 1) ? 2 : 1;
        this.devices = res.data.devices.map(item => {
          item.fullData = this.connection[item.deviceID]
          return item
        });
        this.activeFolders = res.data.folders.map(item => {
          return item.id
        });
        this.folders = res.data.folders.length;
      })
    },

    gotoAdvancedPanel() {
      window.open(this.syncBaseURL, "_blank");
    }
  },
  filters: {
    renderBps(value) {
      if (null == value || value == '' || value == 0) {
        return "0 bps";
      }
      var unitArr = new Array("bps", "Kbps", "Mbps", "Gbps", "TB", "PB", "EB", "ZB", "YB");
      var index = 0,
        srcsize = parseFloat(value);
      index = Math.floor(Math.log(srcsize) / Math.log(1024));
      var size = srcsize / Math.pow(1024, index);
      size = size.toFixed(2);
      return size + " " + unitArr[index];
    },
    renderSize(value) {
      if (null == value || value == '') {
        return "0 Bytes";
      }
      var unitArr = new Array("Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB");
      var index = 0,
        srcsize = parseFloat(value);
      index = Math.floor(Math.log(srcsize) / Math.log(1024));
      var size = srcsize / Math.pow(1024, index);
      size = size.toFixed(2);
      return size + unitArr[index];
    },
  }
}
</script>

<style>
</style>
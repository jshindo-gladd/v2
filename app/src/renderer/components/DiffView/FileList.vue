<template>
  <div class="diff-view_file-list" v-if="row"
    @keyup="moveCursor"
    tabindex="-1"
  >
    <header class="diff-view_file-list_header">{{ row.pathName }}<br>{{ currentBranch }}</header>
    <p class="diff-view_file-list_title">Unstaged Changes</p>
    <ul class="list diff-view_file-list_list">
      <li v-for="(file, i) of files" v-show="file.hasUnstaged">
        <a class="file-status" @click="stage(file, i)">{{ file.working_dir }}</a>
        <span class="path-wrap"
          :class="{ 'is-current': file.path === currentFile.path && !currentFile.isCached }"
          :title="file.path"
          @click="setCurrent(file, false)"
          @contextmenu="menu(file, i)"
        >
          <span class="path-name">{{ file.pathName }}</span><span class="file-name">{{ file.fileName }}</span>
        </span>
      </li>
    </ul>

    <div class="diff-view_file-list_buttons">
      <a @click="stageAll">↓ Stage All</a>&emsp;
      <a @click="unstageAll">↑ Unstage All</a>
    </div>

    <p class="diff-view_file-list_title">Staged Changes (Will Commit)</p>
    <ul class="list diff-view_file-list_list">
      <li v-for="(file, i) of files" v-show="file.hasStaged">
        <a class="file-status" @click="unstage(file, i)">{{ file.index }}</a>
        <span class="path-wrap"
          :title="file.path"
          :class="{ 'is-current': file.path === currentFile.path && currentFile.isCached }"
          @click="setCurrent(file, true)"
          @contextmenu="menu(file, i)"
        >
          <span class="path-name">{{ file.pathName }}</span><span class="file-name">{{ file.fileName }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<script>
  import { gitRaw } from 'renderer/scripts/helpers';
  import fileListMenu from './scripts/fileListMenu';

  export default {
    props: ['currentFile', 'row'],
    data() {
      return {
        files: [],
      };
    },
    computed: {
      currentBranch() {
        const cb = this.row.localBranches.find(v => v.current);
        return cb ? cb.name : '';
      },
    },
    methods: {
      setCurrent(file, isCached) {
        this.currentFile.path = file.path;
        this.currentFile.isCached = isCached;
        this.currentFile.isUntracked = file.index === '?';
        this.currentFile.timestamp = Date.now();
      },

      // 上下キーでカレントファイル変更
      moveCursor(e) {
        const { key } = e;

        if (key !== 'ArrowUp' && key !== 'ArrowDown') return;

        const { currentFile, files } = this;
        const currentIndex = files.findIndex(v => v.path === currentFile.path);
        const otherFiles = [...files.slice(currentIndex + 1), ...files.slice(0, currentIndex)];

        if (key === 'ArrowUp') {
          otherFiles.reverse();
        }

        otherFiles.some((v) => {
          if (currentFile.isCached ? v.hasStaged : v.hasUnstaged) {
            this.setCurrent(v, currentFile.isCached);
            return true; // ループ終了
          }

          return false;
        });
      },

      menu(file, i) {
        fileListMenu(file, i, this);
      },

      async stage(file, i) {
        file.hasStaged = true;
        file.hasUnstaged = false;

        await gitRaw(this.row, ['add', file.path]);
        await this.getStatus(file, i);
        if (file.path !== this.currentFile.path) return;
        this.setCurrent(this.files[i], true);
      },
      async unstage(file, i) {
        file.hasStaged = false;
        file.hasUnstaged = true;

        await gitRaw(this.row, ['reset', 'HEAD', file.path]);
        await this.getStatus(file, i);
        if (file.path !== this.currentFile.path) return;
        this.setCurrent(this.files[i], false);
      },

      async stageAll() {
        await gitRaw(this.row, ['add', '-A']);
        await this.getStatusAll();

        this.files.forEach((file, i) => {
          if (file.path !== this.currentFile.path) return;
          this.setCurrent(this.files[i], true);
        });
      },
      async unstageAll() {
        await gitRaw(this.row, ['reset', 'HEAD']);
        await this.getStatusAll();

        this.files.forEach((file, i) => {
          if (file.path !== this.currentFile.path) return;
          this.setCurrent(this.files[i], false);
        });
      },

      async getStatus(file, i) {
        const data = await gitRaw(this.row, ['status', '--short', '-u', file.path]);
        this.$set(this.files, i, this.getStatusInner(data));
      },
      async getStatusAll() {
        const data = await gitRaw(this.row, ['status', '--short', '-u']);

        // データがなければ空の配列をセット
        if (!data) {
          this.$set(this, 'files', []);
          return;
        }

        this.$set(this, 'files', data.split('\n')
          .filter(v => v)
          .map(this.getStatusInner)
          .sort((a, b) => (a.path.toLowerCase() > b.path.toLowerCase() ? 1 : -1))
        );
      },
      getStatusInner(line) {
        const index = line.substr(0, 1);
        const workingDir = line.substr(1, 1);
        const path = line.substr(3).trim();

        const tmpObj = {
          index,
          path,
          working_dir: workingDir,
          pathName: '',
          fileName: path,
          hasUnstaged: workingDir !== ' ',
          hasStaged: (index !== ' ' && index !== '?'),
        };

        const lastIndex = path.lastIndexOf('/');
        if (lastIndex !== -1) {
          tmpObj.pathName = path.substr(0, lastIndex);
          tmpObj.fileName = path.substr(lastIndex);
        }

        return tmpObj;
      },
    },
    watch: {
      'row.statusSummary.files': {
        handler() {
          if (!this.row) return;

          this.getStatusAll();
          this.currentFile.timestamp = Date.now();
        },
        deep: true,
        immediate: true,
      },
      files: {
        handler() {
          this.$emit('changeStaged', this.files.some(v => v.hasStaged));
        },
        deep: true,
        immediate: true,
      },
    },
  };
</script>

<style lang="scss">
.diff-view_file-list {
  display: flex;
  flex-direction: column;
}

.diff-view_file-list_header {
  margin: 0 0 1em;
  opacity: .75;
}
.diff-view_file-list_title {
  margin: 0 0 .25em;
}

.diff-view_file-list_list {
  flex-grow: 1;
  overflow-x: hidden;
  overflow-y: auto;
}
.diff-view_file-list_list > li {
  position: relative;

  &:not(:last-child) {
    margin-bottom: 0;
  }
}

.file-status {
  display: inline-block;
  flex-shrink: 0;
  margin-right: .25em;
  width: 1em;
  text-align: center;
  cursor: pointer;
}
.path-wrap {
  display: inline-flex;
  width: 100%;
  max-width: calc(100% - 30px);
  cursor: pointer;
  vertical-align: top;

  &.is-current::before {
    content: '';
    position: absolute;
    top: 2px;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: -1;
    background-color: var(--diff-bgColor);
  }
  &.is-current::after {
    content: '▶';
    position: absolute;
    top: 0;
    right: -1px;
    bottom: 0;
    margin: auto;
    height: 1em;
    font-size: 10px;
    line-height: 1;
  }
  &:hover .file-name {
    text-decoration: underline;
  }
}
.path-name {
  opacity: .75;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-name {
  font-weight: 500;
  white-space: nowrap;
}

.diff-view_file-list_buttons {
  margin: .75em 0;
  padding-right: 1em;
  text-align: center;
}
</style>

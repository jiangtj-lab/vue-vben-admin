<script lang="ts" setup>
import type { PicApi } from '#/api';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { ElButton, ElCard, ElImage, ElInput, ElMessage } from 'element-plus';

import { uploadPicApi } from '#/api';

defineOptions({ name: 'PicUpload' });

const target = ref('cover');
const loading = ref(false);
const result = ref<null | PicApi.UploadResult>(null);
const fileInput = ref<HTMLInputElement>();

function selectFile() {
  fileInput.value?.click();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  if (!target.value.trim()) {
    ElMessage.warning('请先填写上传目录标识');
    return;
  }

  loading.value = true;
  try {
    result.value = await uploadPicApi(target.value.trim(), file);
    ElMessage.success('上传成功');
  } finally {
    loading.value = false;
    // 允许再次选择同一个文件
    input.value = '';
  }
}
</script>

<template>
  <Page
    description="对接 POST /pic/upload：target 需存在于后端 jmicro.pic.upload.dirs 配置中（如 cover）。"
    title="图片上传"
  >
    <ElCard class="max-w-3xl" header="上传图片">
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <span class="w-20 shrink-0 text-sm">上传目录</span>
          <ElInput v-model="target" class="max-w-70" placeholder="例如 cover" />
        </div>

        <div class="flex items-center gap-3">
          <span class="w-20 shrink-0 text-sm">图片文件</span>
          <ElButton :loading="loading" type="primary" @click="selectFile">
            选择文件并上传
          </ElButton>
          <input
            ref="fileInput"
            accept="image/*"
            class="hidden"
            type="file"
            @change="handleFileChange"
          />
        </div>

        <div v-if="result" class="flex flex-col gap-3 border-t pt-4">
          <div class="flex items-start gap-3 text-sm">
            <span class="text-muted-foreground w-20 shrink-0">原始文件名</span>
            <span class="break-all">{{ result.originalFileName || '-' }}</span>
          </div>
          <div class="flex items-start gap-3 text-sm">
            <span class="text-muted-foreground w-20 shrink-0">新文件名</span>
            <span class="break-all">{{ result.fileName || '-' }}</span>
          </div>
          <div class="flex items-start gap-3 text-sm">
            <span class="text-muted-foreground w-20 shrink-0">访问地址</span>
            <a
              v-if="result.fileUrl"
              class="break-all text-blue-500"
              :href="result.fileUrl"
              rel="noreferrer"
              target="_blank"
            >
              {{ result.fileUrl }}
            </a>
            <span v-else>-</span>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-muted-foreground w-20 shrink-0 text-sm">
              预览
            </span>
            <div class="flex flex-wrap gap-4">
              <ElImage
                v-if="result.fileUrl"
                :preview-src-list="[result.fileUrl]"
                :src="result.fileUrl"
                fit="contain"
                style="width: 120px; height: 120px"
              />
              <ElImage
                v-if="result.thumbnailUrl"
                :preview-src-list="[result.thumbnailUrl]"
                :src="result.thumbnailUrl"
                fit="contain"
                style="width: 120px; height: 120px"
              />
            </div>
          </div>
        </div>
      </div>
    </ElCard>
  </Page>
</template>

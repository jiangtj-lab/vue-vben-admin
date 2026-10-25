<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { BasicOption } from '@vben/types';

import { computed } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();

/** demo-backend 内置演示账号，见 openapi/openapi.yaml */
const DEMO_ACCOUNTS = [
  { label: '管理员 admin', password: 'admin123', value: 'admin' },
  { label: '读者 reader', password: 'reader123', value: 'reader' },
];

const DEMO_ACCOUNT_OPTIONS: BasicOption[] = DEMO_ACCOUNTS.map((item) => ({
  label: item.label,
  value: item.value,
}));

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenSelect',
      componentProps: {
        options: DEMO_ACCOUNT_OPTIONS,
        placeholder: '选择演示账号',
      },
      fieldName: 'selectAccount',
      label: '演示账号',
      rules: z.string().optional(),
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.usernameTip'),
      },
      dependencies: {
        trigger(values, form) {
          if (!values.selectAccount) {
            return;
          }
          const account = DEMO_ACCOUNTS.find(
            (item) => item.value === values.selectAccount,
          );
          if (account) {
            form.setValues({
              password: account.password,
              username: account.value,
            });
          }
        },
        triggerFields: ['selectAccount'],
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
  ];
});
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-register="false"
    @submit="authStore.authLogin"
  />
</template>

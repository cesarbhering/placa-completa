<script setup lang="ts">
const emit = defineEmits<{
  placaDetected: [placa: string]
}>()

const { processing, message, processPhoto } = usePhotoProcessing()
const photoInput = ref<HTMLInputElement | null>(null)

function triggerFileInput() {
  photoInput.value?.click()
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  const result = await processPhoto(file)

  if (result.placa) {
    emit('placaDetected', result.placa)
  }

  // Reset input so same file can be selected again
  if (photoInput.value) {
    photoInput.value.value = ''
  }
}
</script>

<template>
  <div class="photo-upload">
    <input
      ref="photoInput"
      type="file"
      accept="image/*"
      capture="environment"
      style="display: none"
      @change="handleFileChange"
    />

    <button
      type="button"
      class="win-btn win-btn--secondary"
      :disabled="processing"
      @click="triggerFileInput"
    >
      <span v-if="processing">📸 Processando...</span>
      <span v-else>📸 Tirar Foto</span>
    </button>

    <Transition name="fade">
      <div v-if="message" class="photo-message" :class="{ 'photo-message--success': message.includes('detectada') }">
        {{ message }}
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.photo-upload {
  margin-bottom: $space-sm;
}

.photo-message {
  margin-top: $space-xs;
  padding: $space-xs $space-sm;
  font-family: $font-body;
  font-size: 0.75rem;
  background: $powder-blue;
  border-radius: 4px;
  @include win-border-sunken;

  &--success {
    background: lighten($success-green, 40%);
    color: darken($success-green, 10%);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

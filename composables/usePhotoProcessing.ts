export const usePhotoProcessing = () => {
  const { track } = useAnalytics()

  const processing = ref(false)
  const message = ref('')
  const extractedPlaca = ref('')

  const processPhoto = async (file: File): Promise<{ placa?: string; error?: string }> => {
    if (!file) {
      return { error: 'Nenhum arquivo selecionado' }
    }

    if (!file.type.startsWith('image/')) {
      return { error: 'Por favor, selecione uma imagem válida' }
    }

    processing.value = true
    message.value = 'Processando foto...'
    track('photo_upload_start')

    try {
      const formData = new FormData()
      formData.append('photo', file)

      const result = await $fetch<{ placa?: string; error?: string }>('/api/process-photo', {
        method: 'POST',
        body: formData,
      })

      if (result.placa) {
        extractedPlaca.value = result.placa
        message.value = `Placa detectada: ${result.placa}`
        track('photo_upload_success', { placa: result.placa })
        return { placa: result.placa }
      } else {
        message.value = result.error || 'Não foi possível detectar a placa'
        track('photo_upload_error', { error: result.error })
        return { error: result.error }
      }
    } catch (error: any) {
      const errorMsg = error?.data?.error || 'Erro ao processar foto'
      message.value = errorMsg
      track('photo_upload_error', { error: errorMsg })
      return { error: errorMsg }
    } finally {
      processing.value = false
      setTimeout(() => {
        message.value = ''
      }, 5000)
    }
  }

  const reset = () => {
    processing.value = false
    message.value = ''
    extractedPlaca.value = ''
  }

  return {
    processing,
    message,
    extractedPlaca,
    processPhoto,
    reset,
  }
}

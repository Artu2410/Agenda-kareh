import React, { useState } from 'react';
import { API_BASE_URL } from '../services/api'; 
import toast, { CustomToaster } from '../components/Toast';

const TranscriptionPage = () => {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');
  const [transcription, setTranscription] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setTranscription(null);
    }
  };

  const handleSubmit = async () => {
    if (!image) {
      toast.error('Por favor, selecciona una imagen primero.');
      return;
    }

    setLoading(true);
    setTranscription(null);

    const formData = new FormData();
    formData.append('recipe', image);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/transcription/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error en la transcripción' }));
        throw new Error(errorData.message || 'Error en el servidor');
      }

      const result = await response.json();
      setTranscription(result);
      toast.success('¡Transcripción completada!');
    } catch (error) {
      console.error('Error transcribing image:', error);
      toast.error(error.message || 'No se pudo procesar la imagen.');
      setTranscription({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <CustomToaster />
      <h1 className="text-2xl md:text-3xl font-bold mb-4">Transcripción de Recetas Médicas</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="mb-4 text-gray-700">
          Sube una imagen de una receta médica manuscrita y nuestro asistente con IA la convertirá en datos estructurados.
        </p>

        <input 
          type="file" 
          accept="image/*" 
          onChange={handleImageChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />

        {preview && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Vista previa de la imagen:</h3>
            <img src={preview} alt="Vista previa de receta" className="max-w-sm mx-auto rounded-md shadow-lg" />
          </div>
        )}

        <div className="mt-6 text-center">
          <button 
            onClick={handleSubmit}
            disabled={loading || !image}
            className="bg-blue-600 text-white font-bold py-2 px-6 rounded-full disabled:bg-gray-400 hover:bg-blue-700 transition duration-300"
          >
            {loading ? 'Procesando...' : 'Transcribir Imagen'}
          </button>
        </div>

        {transcription && (
          <div className="mt-8 bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">Resultado de la Transcripción:</h3>
            <pre className="bg-gray-900 text-white p-4 rounded-md overflow-x-auto text-sm">
              {JSON.stringify(transcription, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptionPage;

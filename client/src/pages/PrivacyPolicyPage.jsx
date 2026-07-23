import React from 'react';

const PrivacyPolicyPage = () => {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-4">Política de Privacidad</h1>
      <div className="prose max-w-full">
        <p>
          Esta es la política de privacidad de nuestra aplicación. Aquí describimos cómo recopilamos, usamos y protegemos tu información personal.
        </p>

        <h2 className="text-xl md:text-2xl font-semibold mt-6 mb-2">Información que recopilamos</h2>
        <p>
          Recopilamos información que nos proporcionas directamente, como tu nombre, dirección de correo electrónico y número de teléfono. También podemos recopilar información automáticamente a medida que utilizas la aplicación, como tu dirección IP y el tipo de dispositivo.
        </p>

        <h2 className="text-xl md:text-2xl font-semibold mt-6 mb-2">Cómo usamos tu información</h2>
        <p>
          Utilizamos la información que recopilamos para proporcionar, mantener y mejorar nuestros servicios. Esto incluye:
        </p>
        <ul className="list-disc pl-5">
          <li>Personalizar tu experiencia en la aplicación.</li>
          <li>Comunicarnos contigo sobre tu cuenta o nuestros servicios.</li>
          <li>Enviar notificaciones y recordatorios importantes.</li>
        </ul>

        <h2 className="text-xl md:text-2xl font-semibold mt-6 mb-2">Seguridad de la información</h2>
        <p>
          Nos comprometemos a proteger tu información personal y hemos implementado medidas de seguridad para protegerla contra el acceso no autorizado, la alteración, la divulgación o la destrucción.
        </p>

        <h2 className="text-xl md:text-2xl font-semibold mt-6 mb-2">Cambios en esta política</h2>
        <p>
          Podemos actualizar esta política de privacidad de vez en cuando. Te notificaremos sobre cualquier cambio publicando la nueva política en esta página.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;

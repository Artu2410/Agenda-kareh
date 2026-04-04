import toast from 'react-hot-toast';

export const showSuccessToast = (message, duration = 3000) => {
  toast.success(message, { duration });
};

export const showErrorToast = (message, duration = 4000) => {
  toast.error(message, { duration });
};

export const showLoadingToast = (message, id = 'loading') => {
  toast.loading(message, { id });
};

export const updateToast = (id, message, type = 'success') => {
  toast.dismiss(id);

  if (type === 'success') {
    toast.success(message);
    return;
  }

  if (type === 'error') {
    toast.error(message);
  }
};

export default toast;

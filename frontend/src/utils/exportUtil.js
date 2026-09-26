import api from '../services/api';

/**
 * Robust CSV download utility that sends Authorization Bearer headers via Axios,
 * parses server error responses if any, extracts server-suggested filenames,
 * and triggers immediate browser download.
 *
 * @param {string} endpoint - API path (e.g. '/reports/export/interns' or '/reports/export/attendance')
 * @param {string} fallbackFilename - Default filename for download
 * @param {object} params - Query parameters (filters)
 */
export const downloadCSV = async (endpoint, fallbackFilename, params = {}) => {
  try {
    const res = await api.get(endpoint, {
      params,
      responseType: 'blob'
    });

    // Check if response is actually an error JSON masked as blob
    if (res.data.type && res.data.type.includes('application/json')) {
      const text = await res.data.text();
      const errJson = JSON.parse(text);
      throw new Error(errJson.message || 'Export failed.');
    }

    // Attempt to extract server-provided filename from Content-Disposition header
    let filename = fallbackFilename;
    const disposition = res.headers['content-disposition'];
    if (disposition && disposition.includes('filename=')) {
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }

    if (!filename) {
      const dateStamp = new Date().toISOString().split('T')[0];
      filename = `jowis-export-${dateStamp}.csv`;
    }

    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true, filename };
  } catch (error) {
    let errorMsg = 'Failed to generate export file. Please try again.';
    if (error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const errJson = JSON.parse(text);
        if (errJson.message) errorMsg = errJson.message;
      } catch (e) {
        // use fallback
      }
    } else if (error.message) {
      errorMsg = error.message;
    }
    console.error('Export Error:', errorMsg);
    throw new Error(errorMsg);
  }
};

export default {
  downloadCSV
};

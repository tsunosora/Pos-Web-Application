import api from './client';

export const getWhatsappStatus = async () => (await api.get('/whatsapp/status')).data;
export const getWhatsappConfig = async () => (await api.get('/whatsapp/config')).data;
export const getWhatsappGroups = async () => (await api.get('/whatsapp/groups')).data;
export const logoutWhatsapp = async () => (await api.post('/whatsapp/logout')).data;
export const sendWhatsappToGroup = async (groupId: string, message: string) =>
    (await api.post('/whatsapp/send', { groupId, message })).data;
export const broadcastWhatsapp = async (message: string) =>
    (await api.post('/whatsapp/broadcast', { message })).data;
export const sendWhatsappAnnouncement = async (message: string) =>
    (await api.post('/whatsapp/announce', { message })).data;
export const updateWhatsappBroadcastGroups = async (data: { add?: string; remove?: string }) =>
    (await api.post('/whatsapp/config/broadcast-groups', data)).data;
export const setWhatsappAnnouncement = async (channelId: string | null) =>
    (await api.post('/whatsapp/config/announcement', { channelId })).data;

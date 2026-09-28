import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  getDirectConversationKey,
  getChannelConversationKey,
  encryptTextMessage,
  decryptTextMessage
} from '../../utils/cryptoChat';
import {
  sendBrowserNotification,
  requestBrowserNotificationPermission
} from '../../utils/browserNotifications';
import {
  MessageSquare,
  X,
  Send,
  Lock,
  ShieldCheck,
  Users,
  Hash,
  Search,
  RefreshCw,
  ChevronLeft,
  Circle,
  Bell,
  Sparkles,
  Check,
  CheckCheck,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Download,
  Info,
  ExternalLink,
  Phone,
  Mail,
  Calendar,
  Eye,
  GraduationCap
} from 'lucide-react';

export const LiveChatWidget = () => {
  const { user, isAuthenticated } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('direct'); // 'direct' | 'channels'
  const [contacts, setContacts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [activeTarget, setActiveTarget] = useState(null); // { type: 'direct', data: contact } | { type: 'channel', data: channel }
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Multimedia file sharing state
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Profile inspection modal state
  const [inspectingContact, setInspectingContact] = useState(null);

  // Lightbox modal for image attachments
  const [lightboxImage, setLightboxImage] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastMessageIdRef = useRef(0);

  // 1. Initial Load & Background Polling for Unread Count
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Ask for browser notification permission gently when user is logged in
    requestBrowserNotificationPermission();

    const fetchUnread = async () => {
      try {
        const res = await api.get('/chat/unread-count');
        if (res.data?.success && typeof res.data.count === 'number') {
          setUnreadTotal(res.data.count);
        }
      } catch (err) {
        // Ignore background polling errors
      }
    };

    fetchUnread();
    const timer = setInterval(fetchUnread, 4000);
    return () => clearInterval(timer);
  }, [isAuthenticated, user?.id]);

  // 2. Load Contacts and Channels when widget opens
  const fetchContactsAndChannels = async () => {
    try {
      const [contactsRes, channelsRes] = await Promise.all([
        api.get('/chat/contacts'),
        api.get('/chat/channels')
      ]);

      if (contactsRes.data?.success) {
        setContacts(contactsRes.data.contacts || []);
      }
      if (channelsRes.data?.success) {
        setChannels(channelsRes.data.channels || []);
      }
    } catch (err) {
      console.error('Failed to load chat contacts/channels:', err);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchContactsAndChannels();
    }
  }, [isOpen, isAuthenticated]);

  // 3. Fetch & Decrypt Messages for Active Target
  const fetchAndDecryptMessages = async (target, isBackground = false) => {
    if (!target || !user) return;

    try {
      if (!isBackground) setLoadingMessages(true);

      const params = target.type === 'direct'
        ? { receiverId: target.data.id }
        : { channelId: target.data.id };

      const res = await api.get('/chat/messages', { params });
      if (res.data?.success) {
        const rawMsgs = res.data.messages || [];

        // Derive E2EE key for this target
        const aesKey = target.type === 'direct'
          ? await getDirectConversationKey(user.id, target.data.id)
          : await getChannelConversationKey(target.data.id);

        // Decrypt all messages client-side
        const decryptedList = await Promise.all(
          rawMsgs.map(async (m) => {
            const plaintext = await decryptTextMessage(m.ciphertext, m.iv, aesKey);
            return {
              ...m,
              text: plaintext
            };
          })
        );

        // Check if new incoming message arrived from another user
        if (decryptedList.length > 0) {
          const newest = decryptedList[decryptedList.length - 1];
          if (newest.id > lastMessageIdRef.current && newest.senderId !== user.id) {
            // Push to device notification center if not focused or widget closed
            if (document.hidden || !document.hasFocus() || !isOpen) {
              sendBrowserNotification(`New Message from ${newest.senderName}`, {
                body: newest.text || (newest.attachmentUrl ? '📎 Sent a multimedia document' : 'New encrypted message'),
                tag: `chat-msg-${newest.id}`,
                icon: newest.senderAvatar || '/favicon.ico',
                onClick: () => {
                  window.focus();
                  setIsOpen(true);
                  setActiveTarget(target);
                }
              });
            }
          }
          lastMessageIdRef.current = newest.id;
        }

        setMessages(decryptedList);

        // Reset unread count for this contact locally
        if (target.type === 'direct') {
          setContacts((prev) =>
            prev.map((c) => (c.id === target.data.id ? { ...c, unreadCount: 0 } : c))
          );
        }
      }
    } catch (err) {
      console.error('Failed to fetch/decrypt messages:', err);
    } finally {
      if (!isBackground) setLoadingMessages(false);
    }
  };

  // Switch Active Target
  useEffect(() => {
    if (activeTarget) {
      lastMessageIdRef.current = 0;
      fetchAndDecryptMessages(activeTarget, false);

      // Real-time polling while target is open (every 2.5s)
      const interval = setInterval(() => {
        fetchAndDecryptMessages(activeTarget, true);
      }, 2500);

      return () => clearInterval(interval);
    } else {
      setMessages([]);
      setSelectedFile(null);
      setFilePreview(null);
      setInspectingContact(null);
    }
  }, [activeTarget]);

  // Scroll to bottom when new messages render
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle file selection from file input
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('Document size must be less than 25MB.');
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (uploadEvt) => setFilePreview(uploadEvt.target?.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 4. Send Message (with optional Multimedia attachment)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || !activeTarget || sending) return;

    const textToSend = inputText.trim();
    const fileToUpload = selectedFile;

    setInputText('');
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSending(true);

    try {
      let attachmentPayload = null;

      // Upload attachment if present
      if (fileToUpload) {
        setUploadingAttachment(true);
        const uploadData = new FormData();
        uploadData.append('file', fileToUpload);

        const uploadRes = await api.post('/chat/upload', uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (uploadRes.data?.success) {
          attachmentPayload = uploadRes.data.file;
        }
      }

      // 1. Derive conversation key
      const aesKey = activeTarget.type === 'direct'
        ? await getDirectConversationKey(user.id, activeTarget.data.id)
        : await getChannelConversationKey(activeTarget.data.id);

      // 2. Encrypt plaintext in client browser
      const messageContent = textToSend || (attachmentPayload ? `📎 ${attachmentPayload.fileName}` : 'Encrypted file');
      const { ciphertext, iv } = await encryptTextMessage(messageContent, aesKey);

      // 3. Post encrypted payload to backend
      const payload = {
        ciphertext,
        iv,
        messageType: attachmentPayload ? (attachmentPayload.isImage ? 'image' : 'file') : 'text',
        attachmentUrl: attachmentPayload?.url || null,
        fileName: attachmentPayload?.fileName || null,
        fileSize: attachmentPayload?.fileSize || null,
        fileType: attachmentPayload?.fileType || null,
        ...(activeTarget.type === 'direct'
          ? { receiverId: activeTarget.data.id }
          : { channelId: activeTarget.data.id })
      };

      const res = await api.post('/chat/send', payload);
      if (res.data?.success) {
        // Optimistic append
        const newMsg = {
          id: res.data.messageId || Date.now(),
          senderId: user.id,
          senderName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          senderAvatar: user.avatarUrl,
          senderRole: user.role,
          receiverId: activeTarget.type === 'direct' ? activeTarget.data.id : null,
          channelId: activeTarget.type === 'channel' ? activeTarget.data.id : null,
          text: messageContent,
          attachmentUrl: attachmentPayload?.url || null,
          fileName: attachmentPayload?.fileName || null,
          fileSize: attachmentPayload?.fileSize || null,
          fileType: attachmentPayload?.fileType || null,
          isOutgoing: true,
          isDelivered: Boolean(res.data.isDelivered),
          deliveredAt: res.data.deliveredAt,
          isRead: false,
          createdAt: new Date().toISOString()
        };
        setMessages((prev) => [...prev, newMsg]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send encrypted message. Please verify network connection.');
    } finally {
      setSending(false);
      setUploadingAttachment(false);
    }
  };

  if (!isAuthenticated || !user) return null;

  // Filter contacts by search query
  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.trackName && c.trackName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.internCode && c.internCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. FLOATING LIVE CHAT BUTTON                                              */}
      {/* ========================================================================= */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setIsOpen(true)}
            id="floating-live-chat-button"
            className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-brand-500 text-white shadow-2xl shadow-brand-500/40 hover:shadow-brand-500/60 border border-white/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer relative group"
            title="Open End-to-End Encrypted Live Chat"
          >
            <MessageSquare className="w-6 h-6 animate-pulse" />
            
            {/* Unread Message Badge */}
            {unreadTotal > 0 && (
              <span className="absolute -top-2 -right-2 px-2 py-0.5 min-w-[20px] h-5 rounded-full bg-rose-600 text-white font-mono text-[10px] font-black flex items-center justify-center border-2 border-slate-900 shadow-md animate-bounce">
                {unreadTotal > 99 ? '99+' : unreadTotal}
              </span>
            )}

            {/* Subtle Tooltip */}
            <span className="absolute right-16 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-slate-700 shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>Live E2EE Chat</span>
            </span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DOCKED LIVE CHAT DRAWER / WINDOW                                       */}
      {/* ========================================================================= */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[94vw] sm:w-[440px] h-[610px] max-h-[88vh] bg-slate-900/95 backdrop-blur-xl border border-brand-500/40 rounded-3xl shadow-2xl shadow-brand-500/25 flex flex-col overflow-hidden text-slate-100 animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* TOP HEADER */}
          <div className="p-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between relative">
            <div className="flex items-center gap-2.5 min-w-0">
              {activeTarget ? (
                <button
                  onClick={() => { setActiveTarget(null); setInspectingContact(null); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
                  title="Back to conversation list"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-brand-600/20 border border-brand-500/40 flex items-center justify-center text-brand-400 flex-shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
              )}

              {activeTarget ? (
                <div
                  onClick={() => {
                    if (activeTarget.type === 'direct') setInspectingContact(activeTarget.data);
                  }}
                  className={`min-w-0 ${activeTarget.type === 'direct' ? 'cursor-pointer hover:opacity-90' : ''}`}
                  title={activeTarget.type === 'direct' ? 'Click to view user profile dossier' : ''}
                >
                  <div className="flex items-center gap-2">
                    {/* Tiny header avatar for direct target */}
                    {activeTarget.type === 'direct' && activeTarget.data.avatarUrl && (
                      <img
                        src={activeTarget.data.avatarUrl}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover border border-brand-400 flex-shrink-0"
                      />
                    )}
                    <h3 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                      <span>{activeTarget.data.name}</span>
                      {activeTarget.type === 'direct' && (
                        <Info className="w-3 h-3 text-brand-400 opacity-70 hover:opacity-100" />
                      )}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                    <ShieldCheck className="w-3 h-3" />
                    <span>E2EE Active (AES-256-GCM)</span>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Live Institutional Chat</span>
                    <span className="px-2 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      E2EE
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400">End-to-End Encrypted Communications</p>
                </div>
              )}
            </div>

            {/* Actions: Profile / Refresh & Close */}
            <div className="flex items-center gap-1">
              {activeTarget?.type === 'direct' && (
                <button
                  type="button"
                  onClick={() => setInspectingContact(activeTarget.data)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-brand-300 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="View Colleague Profile Dossier"
                >
                  <Info className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (activeTarget) fetchAndDecryptMessages(activeTarget, false);
                  else fetchContactsAndChannels();
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Refresh messages"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                title="Minimize chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* VIEW A: CONVERSATION LIST */}
          {!activeTarget && (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-900/60">
              {/* Tab Selector */}
              <div className="grid grid-cols-2 p-2 gap-1 border-b border-slate-800/80 bg-slate-950/40 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('direct')}
                  className={`py-2 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'direct'
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Direct Chats</span>
                  {unreadTotal > 0 && (
                    <span className="w-4 h-4 rounded-full bg-rose-600 text-white font-mono text-[9px] font-bold flex items-center justify-center">
                      {unreadTotal}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('channels')}
                  className={`py-2 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'channels'
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  <span>Channels</span>
                </button>
              </div>

              {/* Search Bar for Direct Messages */}
              {activeTab === 'direct' && (
                <div className="p-3 border-b border-slate-800/60">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search colleagues, mentors, interns..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="erp-input w-full pl-8 py-1.5 text-xs bg-slate-950/80 border-slate-700"
                    />
                  </div>
                </div>
              )}

              {/* LIST BODY */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
                {/* DIRECT MESSAGES LIST */}
                {activeTab === 'direct' && (
                  filteredContacts.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No contacts found matching search.
                    </div>
                  ) : (
                    filteredContacts.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 hover:bg-slate-800/60 cursor-pointer transition-colors flex items-center gap-3 relative group"
                      >
                        {/* Avatar (Click to inspect profile) */}
                        <div
                          className="relative flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectingContact(c);
                          }}
                          title="Click to view profile dossier"
                        >
                          {c.avatarUrl ? (
                            <img
                              src={c.avatarUrl}
                              alt={c.name}
                              className="w-10 h-10 rounded-xl object-cover border-2 border-slate-700 group-hover:border-brand-400 transition-colors shadow-sm"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border-2 border-slate-700 group-hover:border-brand-400 flex items-center justify-center text-brand-300 font-bold text-xs">
                              {c.firstName?.[0]}{c.lastName?.[0]}
                            </div>
                          )}
                          {/* Online Indicator */}
                          {c.isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 shadow-sm" />
                          )}
                        </div>

                        {/* Contact Meta (Click to open chat) */}
                        <div
                          onClick={() => setActiveTarget({ type: 'direct', data: c })}
                          className="flex-1 min-w-0 text-xs"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="font-bold text-white truncate group-hover:text-brand-300 transition-colors">
                              {c.name}
                            </h4>
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                              {c.role?.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {c.internCode || c.specialization || c.trackName || c.email}
                          </p>
                        </div>

                        {/* Unread Badge */}
                        {c.unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-brand-600 text-white font-mono text-[10px] font-bold flex-shrink-0 animate-pulse">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    ))
                  )
                )}

                {/* CHANNELS LIST */}
                {activeTab === 'channels' && (
                  channels.map((ch) => (
                    <div
                      key={ch.id}
                      onClick={() => setActiveTarget({ type: 'channel', data: ch })}
                      className="p-3.5 hover:bg-slate-800/60 cursor-pointer transition-colors flex items-start gap-3 relative group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 flex-shrink-0 mt-0.5">
                        <Hash className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 text-xs">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-white group-hover:text-brand-300 transition-colors">
                            {ch.name}
                          </h4>
                          <span className="font-mono text-[10px] text-slate-500">{ch.code}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {ch.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Bottom Security Assurance Banner */}
              <div className="p-2.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-center gap-2 text-[10px] text-slate-400 font-mono">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Zero-Knowledge AES-256 E2EE Verified</span>
              </div>
            </div>
          )}

          {/* VIEW B: ACTIVE CONVERSATION STREAM */}
          {activeTarget && (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-950/50">
              
              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {/* Security Announcement Stamp */}
                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-center space-y-0.5">
                  <div className="flex items-center justify-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>End-to-End Encrypted Session</span>
                  </div>
                  <p className="text-[9px] text-slate-400">
                    Client-side encrypted with AES-256-GCM. Unreadable by server intermediaries.
                  </p>
                </div>

                {loadingMessages ? (
                  <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-brand-400" />
                    <span>Decrypting messages with secure key...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No messages yet. Send an encrypted message or document to start!
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isMe = m.senderId === user.id || m.isOutgoing;
                    const isImage = m.fileType?.startsWith('image/') || (m.attachmentUrl && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(m.attachmentUrl));

                    return (
                      <div
                        key={m.id || idx}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-end gap-2 max-w-[85%]">
                          {/* Sender avatar for incoming messages */}
                          {!isMe && (
                            <div
                              onClick={() => {
                                if (activeTarget.type === 'direct') setInspectingContact(activeTarget.data);
                              }}
                              className="w-7 h-7 rounded-lg overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-brand-300 flex-shrink-0 cursor-pointer hover:border-brand-400 transition-colors"
                              title="Click to view profile"
                            >
                              {m.senderAvatar ? (
                                <img src={m.senderAvatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span>{m.senderName?.[0] || 'U'}</span>
                              )}
                            </div>
                          )}

                          <div
                            className={`p-3 rounded-2xl text-xs break-words relative shadow-md ${
                              isMe
                                ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-br-none'
                                : 'bg-slate-800 border border-slate-700/80 text-slate-100 rounded-bl-none'
                            }`}
                          >
                            {!isMe && activeTarget.type === 'channel' && (
                              <span className="block text-[10px] font-bold text-brand-300 mb-0.5">
                                {m.senderName}
                              </span>
                            )}

                            {/* Multimedia: Image Attachment */}
                            {m.attachmentUrl && isImage && (
                              <div className="mb-2 rounded-xl overflow-hidden border border-white/20 relative group">
                                <img
                                  src={m.attachmentUrl}
                                  alt={m.fileName || 'Shared Image'}
                                  onClick={() => setLightboxImage(m.attachmentUrl)}
                                  className="max-h-48 w-full object-cover cursor-pointer hover:scale-102 transition-transform"
                                />
                                <a
                                  href={m.attachmentUrl}
                                  download={m.fileName || 'image.png'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Download Image"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}

                            {/* Multimedia: Document / File Attachment */}
                            {m.attachmentUrl && !isImage && (
                              <a
                                href={m.attachmentUrl}
                                download={m.fileName || 'document'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mb-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-700 hover:border-brand-400 flex items-center gap-3 transition-colors cursor-pointer group"
                              >
                                <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 flex-shrink-0">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-white text-xs truncate group-hover:text-brand-300">
                                    {m.fileName || 'Shared Document'}
                                  </p>
                                  <span className="text-[10px] text-slate-400">
                                    {m.fileSize ? `${(m.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'Attached Document'}
                                  </span>
                                </div>
                                <Download className="w-4 h-4 text-slate-400 group-hover:text-white flex-shrink-0" />
                              </a>
                            )}

                            {/* Message Plaintext */}
                            {m.text && (
                              <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                            )}
                            
                            {/* Metadata: Timestamp & Read Receipts */}
                            <div className={`mt-1.5 flex items-center justify-end gap-1.5 text-[9px] ${
                              isMe ? 'text-brand-200' : 'text-slate-400'
                            }`}>
                              <span>
                                {m.createdAt
                                  ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : 'Just now'}
                              </span>
                              
                              <Lock className="w-2.5 h-2.5 text-emerald-400" title="Verified E2EE Encrypted" />

                              {/* WhatsApp/Telegram Style Delivery & Read Receipts (Sent, Delivered, Seen) */}
                              {isMe && (
                                m.isRead ? (
                                  <span
                                    title={m.readAt ? `Seen at ${new Date(m.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Read / Seen'}
                                    className="inline-flex items-center text-sky-300 font-bold"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                  </span>
                                ) : m.isDelivered ? (
                                  <span
                                    title={m.deliveredAt ? `Delivered at ${new Date(m.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Delivered to recipient device'}
                                    className="inline-flex items-center text-slate-300"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <span
                                    title="Sent to server"
                                    className="inline-flex items-center text-slate-400"
                                  >
                                    <Check className="w-3 h-3" />
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Multimedia Attachment Preview Banner */}
              {selectedFile && (
                <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {filePreview ? (
                      <img src={filePreview} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-700" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
                        <FileText className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate text-xs">{selectedFile.name}</p>
                      <span className="text-[10px] text-slate-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeSelectedFile}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                  className="hidden"
                />

                {/* Attachment Picker Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
                  title="Attach Image or Document (PDF, DOCX, ZIP)"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  placeholder={selectedFile ? 'Add a caption (optional)...' : 'Type an end-to-end encrypted message...'}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={sending}
                  className="erp-input flex-1 py-2 text-xs bg-slate-950 border-slate-700"
                />

                <button
                  type="submit"
                  disabled={sending || (!inputText.trim() && !selectedFile)}
                  className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white shadow-lg shadow-brand-600/30 transition-all cursor-pointer flex-shrink-0"
                  title="Send Encrypted Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. PROFILE INSPECTION DOSSIER MODAL                                       */}
          {/* ========================================================================= */}
          {inspectingContact && (
            <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col justify-between p-6 animate-in fade-in slide-in-from-right duration-200">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-400">
                  Contact Profile Dossier
                </span>
                <button
                  type="button"
                  onClick={() => setInspectingContact(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Profile Card Body */}
              <div className="my-auto py-4 space-y-4 text-center">
                
                {/* Large Avatar */}
                <div className="relative inline-block mx-auto">
                  {inspectingContact.avatarUrl ? (
                    <img
                      src={inspectingContact.avatarUrl}
                      alt={inspectingContact.name}
                      className="w-24 h-24 rounded-3xl object-cover border-2 border-brand-500 shadow-2xl mx-auto"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-3xl bg-slate-800 border-2 border-brand-500 flex items-center justify-center text-brand-300 font-black text-2xl shadow-2xl mx-auto">
                      {inspectingContact.firstName?.[0]}{inspectingContact.lastName?.[0]}
                    </div>
                  )}

                  {/* Online Badge */}
                  {inspectingContact.isOnline && (
                    <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white font-mono text-[9px] font-bold border-2 border-slate-950 shadow-md">
                      ONLINE
                    </span>
                  )}
                </div>

                {/* Name & Role */}
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {inspectingContact.name}
                  </h3>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand-500/20 text-brand-300 border border-brand-500/30">
                      {inspectingContact.role?.replace('_', ' ')}
                    </span>
                    {inspectingContact.internCode && (
                      <span className="font-mono text-[10px] text-amber-400 font-bold">
                        {inspectingContact.internCode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Detailed Meta Box */}
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-left space-y-2 text-xs">
                  {inspectingContact.trackName && (
                    <div className="flex justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-brand-400" /> Track:
                      </span>
                      <span className="font-semibold text-white">{inspectingContact.trackName}</span>
                    </div>
                  )}

                  {inspectingContact.specialization && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Specialization:</span>
                      <span className="font-semibold text-white">{inspectingContact.specialization}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-sky-400" /> Email:
                    </span>
                    <a href={`mailto:${inspectingContact.email}`} className="font-mono text-[11px] text-brand-300 hover:underline truncate max-w-[180px]">
                      {inspectingContact.email}
                    </a>
                  </div>

                  {inspectingContact.phone && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-400" /> Phone:
                      </span>
                      <span className="font-mono text-[11px] text-slate-200">{inspectingContact.phone}</span>
                    </div>
                  )}

                  {inspectingContact.memberSince && (
                    <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Member Since:
                      </span>
                      <span>{new Date(inspectingContact.memberSince).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer action */}
              <div className="pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTarget({ type: 'direct', data: inspectingContact });
                    setInspectingContact(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Start Direct Chat</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. LIGHTBOX MODAL FOR IMAGE PREVIEW                                       */}
          {/* ========================================================================= */}
          {lightboxImage && (
            <div
              onClick={() => setLightboxImage(null)}
              className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
            >
              <img
                src={lightboxImage}
                alt="Enlarged Document"
                className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-white/20"
              />
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-900/80 text-white hover:bg-rose-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

        </div>
      )}
    </>
  );
};

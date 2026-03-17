import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, MessageCircle, Globe, Code2 } from 'lucide-react';
import TiltedCard from './TiltedCard';
import divyanshuImg from '../Public/divyanshu.jpg';

export default function DeveloperFooter() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      {/* Footer bar */}
      <div className="w-full border-t border-white/10 bg-black/20 backdrop-blur-sm py-2 px-4 flex items-center justify-center gap-2 text-xs text-slate-500 print:hidden">
        <span>Created By</span>
        <span className="font-semibold text-slate-400">Divyanshu Kumar</span>
        <span className="text-slate-600">·</span>
        <button
          id="view-developer-btn"
          onClick={() => setShowModal(true)}
          className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors underline underline-offset-2 cursor-pointer"
        >
          View Developer
        </button>
      </div>

      {/* Modal Popup */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 print:hidden"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowModal(false)}
                className="absolute -top-3 -right-3 z-10 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white p-1.5 rounded-full shadow-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Card */}
              <div className="rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
                  border: '1px solid rgba(99,102,241,0.3)'
                }}
              >
                {/* Tilted Avatar Section */}
                <div className="flex justify-center pt-8 pb-4">
                  <TiltedCard
                    imageSrc={divyanshuImg}
                    altText="Divyanshu Kumar"
                    captionText="Divyanshu Kumar"
                    containerHeight="180px"
                    containerWidth="180px"
                    imageHeight="180px"
                    imageWidth="180px"
                    rotateAmplitude={12}
                    scaleOnHover={1.05}
                    showMobileWarning={false}
                    showTooltip={true}
                    displayOverlayContent={true}
                    overlayContent={
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                        <span className="bg-indigo-600/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                          Full Stack Dev
                        </span>
                      </div>
                    }
                  />
                </div>

                {/* Info */}
                <div className="px-6 pb-6 text-center">
                  <h2 className="text-2xl font-bold text-white mb-1">Divyanshu Kumar</h2>
                  <p className="text-indigo-400 text-sm mb-5 font-medium">Software Engineer · NextGen Software</p>

                  <div className="space-y-3">
                    {/* Phone */}
                    <a
                      href="tel:+919798263469"
                      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all group"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-green-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-slate-500">Call Developer</p>
                        <p className="text-sm font-semibold text-white">+91 9798263469</p>
                      </div>
                    </a>

                    {/* WhatsApp */}
                    <a
                      href="https://api.whatsapp.com/send/?phone=919798263469&text=Hello%20From%20Resturant%20mangement%20software%20.%20I%20need%20to%20connect.&type=phone_number&app_absent=0"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all group"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <MessageCircle className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-slate-500">WhatsApp</p>
                        <p className="text-sm font-semibold text-white">Send a Message</p>
                      </div>
                      <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                        Chat
                      </span>
                    </a>

                    {/* Website */}
                    <a
                      href="https://nextgensoftware.vercel.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all group"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                        <Globe className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-slate-500">Website</p>
                        <p className="text-sm font-semibold text-white">nextgensoftware.in</p>
                      </div>
                    </a>
                  </div>

                  {/* Badge */}
                  <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-600">
                    <Code2 className="w-3 h-3" />
                    <span>Built with React + Node.js + Socket.IO</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

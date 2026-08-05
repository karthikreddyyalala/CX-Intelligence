import React from 'react';
import {
  SiGooglemaps, SiTrustpilot, SiYelp, SiFacebook, SiReddit, SiX,
  SiInstagram, SiYoutube, SiGoogleplay, SiAppstore, SiTripadvisor,
} from 'react-icons/si';
import { FaGlobe, FaClipboardCheck, FaCommentDots, FaShieldHalved } from 'react-icons/fa6';

// Real, recognizable brand marks — rendered monochrome (currentColor) so the VP
// instantly recognizes each platform while the palette stays cohesive.
const MAP = {
  'Google Maps':     SiGooglemaps,
  'Trustpilot':      SiTrustpilot,
  'Yelp':            SiYelp,
  'Facebook':        SiFacebook,
  'Reddit':          SiReddit,
  'Twitter/X':       SiX,
  'Instagram':       SiInstagram,
  'YouTube':         SiYoutube,
  'Google Play':     SiGoogleplay,
  'App Store':       SiAppstore,
  'TripAdvisor':     SiTripadvisor,
  'BBB':             FaShieldHalved,
  'ConsumerAffairs': FaClipboardCheck,
  'Website':         FaGlobe,
};

export default function SourceIcon({ source, size = 15, className = '' }) {
  const Icon = MAP[source] || FaCommentDots;
  return <Icon size={size} className={className} aria-hidden="true" />;
}

// Live channels only — every one has real, scraped reviews behind it.
export const SOURCE_LIST = [
  'Google Maps', 'App Store', 'Trustpilot', 'Google Play', 'Reddit',
];

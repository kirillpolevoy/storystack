import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import dayjs from 'dayjs';
import { supabase } from '@/lib/supabase';
import { Asset, Campaign, TagVocabulary, BASE_TAGS, BRAND_TAGS } from '@/types';
import { TagFilterBar } from '@/components/TagFilterBar';
import { TagModal } from '@/components/TagModal';
import { getAllAvailableTags } from '@/utils/getAllAvailableTags';

const fallbackCampaign: Campaign = {
  id: 'fallback',
  name: 'Untitled Campaign',
  created_at: new Date().toISOString(),
  user_id: null,
};

const fallbackAssets: Asset[] = [];

export default function CampaignDetailScreen() {
  const router = useRouter();
  if (!router) {
    return null;
  }

  const params = useLocalSearchParams<{ id: string }>();
  const campaignIdParam = params.id;
  const campaignId = Array.isArray(campaignIdParam) ? campaignIdParam[0] : campaignIdParam;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [assets, setAssets] = useState<Asset[]>(fallbackAssets);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TagVocabulary[]>([]);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [allAvailableTags, setAllAvailableTags] = useState<TagVocabulary[]>([]);

  const loadCampaign = useCallback(async () => {
    if (!campaignId) {
      setIsLoading(false);
      return;
    }

    if (!supabase) {
      setCampaign({ ...fallbackCampaign, id: campaignId, name: `Campaign ${campaignId.slice(0, 6)}` });
      setAssets(fallbackAssets);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError) {
      console.error('[CampaignDetail] campaign fetch failed', campaignError);
    } else if (campaignData) {
      setCampaign(campaignData as Campaign);
    }

    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (assetError) {
      console.error('[CampaignDetail] asset fetch failed', assetError);
    } else if (assetData) {
      const mapped = (assetData as Asset[]).map((asset) => {
        const { data } = supabase.storage.from('assets').getPublicUrl(asset.storage_path);
        const tags = Array.isArray(asset.tags) ? (asset.tags as string[]) : [];
        return { ...asset, publicUrl: data.publicUrl, tags } as Asset;
      });
      setAssets(mapped);
    }

    setIsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  // Load all available tags from tag library
  useEffect(() => {
    const loadAvailableTags = async () => {
      try {
        const tags = await getAllAvailableTags();
        setAllAvailableTags(tags);
      } catch (error) {
        console.error('[CampaignDetail] Failed to load available tags:', error);
        // Continue with empty tags array
        setAllAvailableTags([]);
      }
    };
    loadAvailableTags();
  }, []);

  // Reload available tags when tag modal opens (to reflect any changes from tag management)
  useEffect(() => {
    if (isTagModalOpen) {
      const loadAvailableTags = async () => {
        try {
          const tags = await getAllAvailableTags();
          setAllAvailableTags(tags);
        } catch (error) {
          console.error('[CampaignDetail] Failed to reload available tags:', error);
          // Continue with existing tags
        }
      };
      loadAvailableTags();
    }
  }, [isTagModalOpen]);

  const handleImport = useCallback(async () => {
    if (!campaignId) {
      Alert.alert('Missing campaign', 'Cannot import without a campaign.');
      return;
    }

    if (!supabase) {
      Alert.alert('Supabase unavailable', 'Connect Supabase to import assets.');
      return;
    }

    try {
      setIsImporting(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 100,
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      for (const pickerAsset of result.assets) {
        const extension = pickerAsset.uri.split('.').pop() ?? 'jpg';
        const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const fileName = `${uniqueSuffix}.${extension}`;
        const filePath = `campaigns/${campaignId}/${fileName}`;

        const arrayBuffer = await fetch(pickerAsset.uri).then((res) => res.arrayBuffer());

        const { error: uploadError } = await supabase.storage.from('assets').upload(filePath, arrayBuffer, {
          contentType: pickerAsset.mimeType ?? 'image/jpeg',
          upsert: false,
        });
        if (uploadError) {
          throw uploadError;
        }

        const { data: inserted, error: insertError } = await supabase
          .from('assets')
          .insert({
            campaign_id: campaignId,
            storage_path: filePath,
            source: 'local',
            tags: [],
          })
          .select('*')
          .single();

        if (insertError) {
          throw insertError;
        }

        const edgeBase = process.env.EXPO_PUBLIC_EDGE_BASE_URL;
        const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        if (edgeBase && inserted && supabaseAnonKey) {
          const publicUrl = supabase.storage.from('assets').getPublicUrl(filePath).data.publicUrl;
          fetch(`${edgeBase}/auto_tag_asset`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({ assetId: inserted.id, imageUrl: publicUrl }),
          })
            .then(async (res) => {
              if (res.ok) {
                const result = await res.json();
                console.log('[AutoTag] Success! Tags:', result.tags);
                await loadCampaign();
              } else {
                const errorText = await res.text();
                console.error('[AutoTag] Edge function error:', res.status, errorText);
              }
            })
            .catch((err) => console.warn('[AutoTag] Edge request failed', err));
        }
      }

      await loadCampaign();
    } catch (error) {
      console.error('[CampaignDetail] import failed', error);
      Alert.alert('Import failed', 'We could not import one or more photos.');
    } finally {
      setIsImporting(false);
    }
  }, [campaignId, loadCampaign]);

  const headerTitle = campaign?.name ?? `Campaign ${campaignId?.slice(0, 6) ?? ''}`;

  // Collect all unique tags from all assets in the campaign
  const allCampaignTags = useMemo(() => {
    const allTags = new Set<string>();
    assets.forEach((asset) => {
      (asset.tags ?? []).forEach((tag) => {
        if (tag) {
          allTags.add(tag);
        }
      });
    });
    return Array.from(allTags).sort();
  }, [assets]);

  const customFilterTags = useMemo(() => {
    const defaults = new Set<string>([...BASE_TAGS, ...BRAND_TAGS]);
    const extras = new Set<string>();
    assets.forEach((asset) => {
      (asset.tags ?? []).forEach((tag) => {
        if (tag && !defaults.has(tag)) {
          extras.add(tag);
        }
      });
    });
    return Array.from(extras);
  }, [assets]);

  const filteredAssets = useMemo(() => {
    if (!selectedTags.length) return assets;
    return assets.filter((asset) => selectedTags.every((tag) => asset.tags.includes(tag)));
  }, [assets, selectedTags]);

  const toggleTagFilter = (tag: TagVocabulary) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const openTagModal = (asset: Asset) => {
    setActiveAsset(asset);
    setIsTagModalOpen(true);
  };

  const closeTagModal = () => {
    setIsTagModalOpen(false);
    setActiveAsset(null);
  };

  const updateTags = async (newTags: TagVocabulary[]) => {
    if (!activeAsset || !supabase) {
      return;
    }
    const { error } = await supabase
      .from('assets')
      .update({ tags: newTags })
      .eq('id', activeAsset.id);
    if (error) {
      console.error('[CampaignDetail] update tags failed', error);
      Alert.alert('Update failed', 'Unable to update tags.');
    } else {
      await loadCampaign();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fafafa' }}>
      <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#fafafa' }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginBottom: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: '600', color: '#111827' }}>{headerTitle}</Text>
        <Text style={{ marginTop: 4, fontSize: 14, color: '#6B7280' }}>
          Created {campaign?.created_at ? dayjs(campaign.created_at).format('MMM D, YYYY') : 'recently'}
        </Text>
        {supabase ? (
          <TouchableOpacity
            onPress={handleImport}
            disabled={isImporting}
            style={{
              marginTop: 16,
              borderRadius: 999,
              backgroundColor: isImporting ? '#d1d5db' : '#FF9500',
              paddingVertical: 12,
              paddingHorizontal: 20,
              alignSelf: 'flex-start',
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 10,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              {isImporting ? 'Importing…' : 'Import from Camera Roll'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ marginTop: 16, fontSize: 13, color: '#FF9500' }}>
            Supabase not configured. Connect Supabase to import photos.
          </Text>
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FF9500" />
          <Text style={{ marginTop: 8, color: '#6B7280' }}>Loading campaign…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
          <View style={{ padding: 20, borderRadius: 24, backgroundColor: '#fff', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>Overview</Text>
            <Text style={{ marginTop: 8, fontSize: 14, color: '#6B7280' }}>
              {assets.length} asset{assets.length === 1 ? '' : 's'} in this campaign.
            </Text>
            {!supabase ? (
              <Text style={{ marginTop: 12, fontSize: 13, color: '#FF9500' }}>
                Supabase is not configured, so this view is showing placeholder data.
              </Text>
            ) : null}
          </View>

          <TagFilterBar
            selectedTags={selectedTags}
            onToggleTag={toggleTagFilter}
            availableTags={allCampaignTags}
          />

          {filteredAssets.map((asset) => (
            <TouchableOpacity
              key={asset.id}
              onPress={() => openTagModal(asset)}
              activeOpacity={0.85}
              style={{ marginBottom: 12, borderRadius: 20, backgroundColor: '#fff', padding: 16 }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Asset {asset.id.slice(0, 6)}</Text>
              <Text style={{ marginTop: 6, fontSize: 13, color: '#6B7280' }}>
                Added {dayjs(asset.created_at).format('MMM D, YYYY h:mm A')}
              </Text>
              {asset.publicUrl ? (
                <Image
                  source={{ uri: asset.publicUrl }}
                  style={{ marginTop: 12, width: '100%', height: 200, borderRadius: 16 }}
                  resizeMode="cover"
                />
              ) : null}
              {asset.tags.length ? (
                <Text style={{ marginTop: 8, fontSize: 13, color: '#4B5563' }}>Tags: {asset.tags.join(', ')}</Text>
              ) : (
                <Text style={{ marginTop: 8, fontSize: 13, color: '#9CA3AF' }}>No tags yet</Text>
              )}
              <Text style={{ marginTop: 10, fontSize: 12, color: '#9CA3AF' }}>Tap to edit tags</Text>
            </TouchableOpacity>
          ))}

          {!filteredAssets.length ? (
            <View style={{ marginTop: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#6B7280' }}>No assets match the selected tags.</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <TagModal
        asset={activeAsset}
        visible={isTagModalOpen}
        onClose={closeTagModal}
        onUpdateTags={updateTags}
        allAvailableTags={allAvailableTags}
      />
    </View>
  );
}

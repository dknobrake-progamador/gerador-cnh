import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const API_BASE = 'http://SEU_IP_LOCAL:3000';

export default function App() {
  const [apiBase, setApiBase] = useState(API_BASE);
  const [ear, setEar] = useState('S');
  const [texto, setTexto] = useState('');
  const [fotoUri, setFotoUri] = useState('');
  const [loading, setLoading] = useState(false);

  async function escolherFoto() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true
    });

    if (result.canceled) return;
    setFotoUri(result.assets[0].uri);
  }

  async function gerarPdf() {
    if (!texto.toUpperCase().includes('NOME COMPLETO:')) {
      Alert.alert('Erro', 'Texto invalido: precisa conter "NOME COMPLETO:".');
      return;
    }
    if (!fotoUri) {
      Alert.alert('Erro', 'Selecione uma foto.');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('ear', ear);
      form.append('texto', texto);
      form.append('foto', {
        uri: fotoUri,
        name: 'foto.jpg',
        type: 'image/jpeg'
      });

      const response = await fetch(`${apiBase}/api/gerar-pdf?format=base64`, {
        method: 'POST',
        body: form
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || 'Falha ao gerar PDF.');
      }

      const payload = await response.json();
      const base64 = payload.base64;
      const fileName = payload.fileName || 'resultado.pdf';
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Sucesso', `PDF salvo em: ${fileUri}`);
      }
    } catch (err) {
      Alert.alert('Erro', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>Fabrica 3.0 - Expo Go</Text>
        <Text style={styles.sub}>Teste rapido no celular usando seu servidor local.</Text>

        <Text style={styles.label}>URL da API</Text>
        <TextInput
          value={apiBase}
          onChangeText={setApiBase}
          style={styles.input}
          placeholder="http://192.168.0.10:3000"
          autoCapitalize="none"
        />

        <Text style={styles.label}>EAR (S ou N)</Text>
        <TextInput value={ear} onChangeText={setEar} style={styles.input} maxLength={1} />

        <Text style={styles.label}>Texto da CNH</Text>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          style={[styles.input, styles.area]}
          multiline
          placeholder="Cole o texto aqui"
        />

        <Pressable style={styles.secondaryBtn} onPress={escolherFoto}>
          <Text style={styles.btnTxt}>{fotoUri ? 'Foto selecionada' : 'Selecionar foto'}</Text>
        </Pressable>

        <Pressable style={styles.primaryBtn} onPress={gerarPdf} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Gerar PDF</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#eef7ff' },
  wrap: { padding: 16, gap: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  sub: { color: '#334155', marginBottom: 6 },
  label: { fontWeight: '600', color: '#0f172a', marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10
  },
  area: { minHeight: 160, textAlignVertical: 'top' },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46
  },
  secondaryBtn: {
    marginTop: 8,
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44
  },
  btnTxt: { color: '#fff', fontWeight: '700' }
});

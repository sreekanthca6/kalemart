{{/*
Expand the name of the chart.
*/}}
{{- define "kalemart.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "kalemart.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Selector labels for a given component
*/}}
{{- define "kalemart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kalemart.name" . }}
app.kubernetes.io/component: {{ .component }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Image with optional registry prefix
*/}}
{{- define "kalemart.image" -}}
{{- $registry := .global.imageRegistry -}}
{{- $repo := .image.repository -}}
{{- $tag := .image.tag | default "latest" -}}
{{- if $registry -}}
{{ printf "%s/%s:%s" $registry $repo $tag }}
{{- else -}}
{{ printf "%s:%s" $repo $tag }}
{{- end }}
{{- end }}

{{/*
OTel env vars injected into every service
*/}}
{{- define "kalemart.otelEnv" -}}
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: {{ .Values.global.otelEndpoint | quote }}
- name: OTEL_SERVICE_NAME
  value: {{ printf "kalemart-%s" .component | quote }}
{{- end }}

from django.contrib import admin
from .models import (
    FavoriQuestion, Commentaire, MatriculeEtudiant, Question, Tag, categorie,
    Reponse, notification, vue,
)

@admin.register(categorie)
class CategorieAdmin(admin.ModelAdmin):
    list_display = ('nom',)
    search_fields = ('nom',)
    
@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('titre', 'auteur', 'categorie', 'date_creation')
    search_fields = ('titre', 'contenu', 'auteur__username', 'categorie__nom')
    list_filter = ('categorie', 'date_creation')
    filter_horizontal = ('tags',)
    
@admin.register(Reponse)
class ReponseAdmin(admin.ModelAdmin):
    list_display = ('question', 'auteur', 'acceptee', 'date_creation')
    search_fields = ('contenu', 'auteur__username', 'question__titre')
    list_filter = ('acceptee', 'date_creation')

@admin.register(FavoriQuestion)
class FavoriQuestionAdmin(admin.ModelAdmin):
    list_display = ('question', 'utilisateur')
    search_fields = ('question__titre', 'utilisateur__username')

@admin.register(MatriculeEtudiant)
class MatriculeEtudiantAdmin(admin.ModelAdmin):
    list_display = ('numero', 'utilisateur', 'disponible')
    search_fields = ('numero', 'utilisateur__username', 'utilisateur__email')
    readonly_fields = ('utilisateur',)

    @admin.display(boolean=True, description='Disponible')
    def disponible(self, obj):
        return obj.utilisateur_id is None

    def save_model(self, request, obj, form, change):
        obj.numero = obj.numero.strip()
        super().save_model(request, obj, form, change)
    
@admin.register(Commentaire)
class CommentaireAdmin(admin.ModelAdmin):
    list_display = ('reponse', 'auteur', 'date_creation')
    search_fields = ('contenu', 'auteur__username', 'reponse__question__titre')
    list_filter = ('date_creation',)
    
@admin.register(notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('destinateur', 'message', 'lue', 'date_creation')
    search_fields = ('message', 'destinateur__username')
    list_filter = ('lue', 'date_creation')
    
@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('nom',)
    search_fields = ('nom',)
    
@admin.register(vue)
class VueAdmin(admin.ModelAdmin):
    list_display = ('question', 'utilisateur', 'date_vue')
    search_fields = ('utilisateur__username', 'question__titre')
    list_filter = ('date_vue',)
    
from  django.db import models
from django.db.models import Q
from django.contrib.auth.models import User


class categorie(models.Model):
    nom = models.CharField(max_length=100)

    def __str__(self):
        return self.nom
    class Meta:
        verbose_name = "Catégorie"
        verbose_name_plural = "Catégories"  
        

class MatriculeEtudiant(models.Model):
    numero = models.CharField(max_length=50, unique=True)
    utilisateur = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        related_name='matricule_etudiant',
        null=True,
        blank=True,
    )

    def __str__(self):
        return self.numero

    class Meta:
        verbose_name = "Matricule étudiant"
        verbose_name_plural = "Matricules étudiants"


class ProfilUtilisateur(models.Model):
    PROFILS = [
        ('etudiant', 'Étudiant'),
        ('enseignant', 'Enseignant'),
        ('personnel', 'Personnel'),
    ]
    NIVEAUX = [
        ('L1', 'Licence 1'),
        ('L2', 'Licence 2'),
        ('L3', 'Licence 3'),
        ('M1', 'Master 1'),
        ('M2', 'Master 2'),
    ]
    GRADES_ENSEIGNANT = [
        ('assistant', 'Assistant'),
        ('maitre_assistant', 'Maître-assistant'),
        ('maitre_conferences', 'Maître de conférences'),
        ('professeur_titulaire', 'Professeur titulaire'),
    ]

    utilisateur = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profil_utilisateur',
    )
    profil = models.CharField(max_length=20, choices=PROFILS, default='etudiant')
    niveau = models.CharField(max_length=2, choices=NIVEAUX, blank=True)
    grade = models.CharField(max_length=32, choices=GRADES_ENSEIGNANT, blank=True)
    photo = models.ImageField(upload_to='profils/', blank=True)

    def __str__(self):
        return f"Profil de {self.utilisateur.username}"


class Question(models.Model):
      
    
    titre = models.CharField(max_length=200)
    contenu = models.TextField()
    extrait_code = models.TextField(
        blank=True,
        null=True,
        verbose_name="Extrait de code"
    )
    capture_ecran = models.ImageField(
        upload_to='questions/',
        blank=True,
        verbose_name="Capture d'écran",
    )
    auteur = models.ForeignKey(
        User, 
        on_delete=models.CASCADE,
        related_name='questions',
    
    )
    categorie = models.ForeignKey(
        categorie, 
        on_delete=models.CASCADE, 
        related_name='questions'
    )    
    

    tags = models.ManyToManyField('Tag', related_name='questions', blank=True)
    date_creation = models.DateTimeField(auto_now_add=True
    )
    
    def __str__(self):
        return self.titre
    class Meta:
        verbose_name = "Question" 
        verbose_name_plural = "Questions"
        ordering = ['-date_creation']


class CaptureQuestion(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='captures',
    )
    image = models.ImageField(upload_to='questions/')

    def __str__(self):
        return f"Capture de la question : {self.question.titre}"


class FavoriQuestion(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='favoris',
    )
    utilisateur = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='questions_favorites',
    )

    def __str__(self):
        return f"Favori de {self.utilisateur.username} : {self.question.titre}"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['question', 'utilisateur'],
                name='unique_favori_question_utilisateur',
            ),
        ]


class Reponse(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='reponses'
    )
    auteur = models.ForeignKey(
        User, 
        on_delete=models.CASCADE,
        related_name='reponses',
    )
    contenu = models.TextField()
    acceptee = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Réponse à la question : {self.question.titre}"
    class Meta:
        verbose_name = "Réponse"
        verbose_name_plural = "Réponses"
        ordering = ['-date_creation']
        constraints = [
            models.UniqueConstraint(
                fields=['question'],
                condition=Q(acceptee=True),
                name='unique_reponse_acceptee_par_question',
            ),
        ]


class AccordReponse(models.Model):
    reponse = models.ForeignKey(
        Reponse,
        on_delete=models.CASCADE,
        related_name='accords',
    )
    utilisateur = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='accords_reponses',
    )

    def __str__(self):
        return f"Accord de {self.utilisateur.username} sur une réponse"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['reponse', 'utilisateur'],
                name='unique_accord_reponse_utilisateur',
            ),
        ]
        
class Commentaire(models.Model):
    reponse = models.ForeignKey(
        Reponse,
        on_delete=models.CASCADE,
        related_name='commentaires'
    )
    auteur = models.ForeignKey(
        User, 
        on_delete=models.CASCADE,
        related_name='commentaires',
    )
    contenu = models.TextField()
    date_creation = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Commentaire sur la réponse à la question : {self.reponse.question.titre}"
    class Meta:
        verbose_name = "Commentaire"
        verbose_name_plural = "Commentaires"
        ordering = ['-date_creation']
        
class notification(models.Model):
    destinateur = models.ForeignKey(
        User, 
        on_delete=models.CASCADE,
        related_name='notifications'
        )
    acteur = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='notifications_emises',
        null=True,
        blank=True,
    )
    question = models.ForeignKey(
        Question,
        on_delete=models.SET_NULL,
        related_name='notifications',
        null=True,
        blank=True,
    )
    reponse = models.ForeignKey(
        Reponse,
        on_delete=models.SET_NULL,
        related_name='notifications',
        null=True,
        blank=True,
    )
    type = models.CharField(max_length=20, default='reponse')
    message = models.CharField(max_length=255)
    lue = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Notification pour {self.destinateur.username}: {self.message}"

    class Meta:
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering = ['-date_creation']
        
class Tag(models.Model):
    nom = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.nom
    class Meta:
        verbose_name = "Tag"
        verbose_name_plural = "Tags"
        
class vue(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='vues'
    )
    utilisateur = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='vues'
    )
    date_vue = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Vue de {self.utilisateur.username} sur la question : {self.question.titre}"

    class Meta:
        verbose_name = "Vue"
        verbose_name_plural = "Vues"
        ordering = ['-date_vue']
        constraints = [
            models.UniqueConstraint(
                fields=['question', 'utilisateur'],
                name='unique_vue_question_utilisateur',
            ),
        ]
        
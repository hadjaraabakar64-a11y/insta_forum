from django.shortcuts import render
from django import forms
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password
from django.core.validators import EmailValidator
from .models import (
    AccordReponse, CaptureQuestion, Commentaire, FavoriQuestion, MatriculeEtudiant, ProfilUtilisateur,
    Question, Reponse, Tag, categorie, notification, vue,
)
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET
from django.contrib.auth import authenticate, get_user_model
from django.core import signing
from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Q
from django.http import HttpResponseNotAllowed
from django.utils.text import slugify
from django.views.decorators.csrf import csrf_exempt
import json


def accueil(request):
    questions = (
        Question.objects.select_related('auteur', 'categorie')
        .prefetch_related(
            'tags',
            'reponses__auteur',
            'reponses__commentaires__auteur',
        )
    )
    reponses = Reponse.objects.count()

    return render(
        request,
        'notre_app/accueil.html',
        {
            'questions': questions,
            'categories': categorie.objects.all().order_by('nom'),
            'tags': Tag.objects.all().order_by('nom'),
            'nombre_questions': questions.count(),
            'nombre_reponses': reponses,
            'nombre_commentaires': Commentaire.objects.count(),
        },
    )
@require_GET
def get_question_details(request, question_id):
    try:
        question = Question.objects.select_related('auteur', 'categorie').prefetch_related(
            'tags',
            'reponses__auteur',
            'reponses__commentaires__auteur',
        ).get(id=question_id)
    except Question.DoesNotExist:
        return JsonResponse({'error': 'Question not found'}, status=404)

    reponses_data = []
    for reponse in question.reponses.all():
        commentaires_data = [
            {
                'id': commentaire.id,
                'auteur': commentaire.auteur.username,
                'contenu': commentaire.contenu,
                'date_creation': commentaire.date_creation.isoformat(),
            }
            for commentaire in reponse.commentaires.all()
        ]
        reponses_data.append({
            'id': reponse.id,
            'auteur': reponse.auteur.username,
            'contenu': reponse.contenu,
            'date_creation': reponse.date_creation.isoformat(),
            'commentaires': commentaires_data,
        })

    question_data = {
        'id': question.id,
        'titre': question.titre,
        'contenu': question.contenu,
        'auteur': question.auteur.username,
        'categorie': question.categorie.nom,
        'tags': [tag.nom for tag in question.tags.all()],
        'date_creation': question.date_creation.isoformat(),
        'reponses': reponses_data,
    }

    return JsonResponse(question_data)


TOKEN_SALT = 'notre_app.api-token'


def _json_body(request):
    try:
        body = json.loads(request.body or b'{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    return body if isinstance(body, dict) else None


def _user_data(user):
    profil = getattr(user, 'profil_utilisateur', None)
    matricule = getattr(user, 'matricule_etudiant', None)
    est_administrateur = user.is_staff or user.is_superuser
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'prenom': user.first_name,
        'nom': user.last_name,
        'is_staff': est_administrateur,
        'profil': 'administrateur' if est_administrateur else profil.profil if profil else 'etudiant',
        'niveau': profil.niveau if profil and not est_administrateur else '',
        'grade': profil.grade if profil and profil.profil == 'enseignant' and not est_administrateur else '',
        'photo': profil.photo.url if profil and profil.photo else '',
        'matricule': matricule.numero if matricule else '',
    }


def _api_user(request):
    authorization = request.headers.get('Authorization', '')
    scheme, _, token = authorization.partition(' ')
    if scheme.lower() != 'token' or not token:
        return None
    try:
        user_id = signing.loads(token, salt=TOKEN_SALT, max_age=60 * 60 * 24 * 30)
    except signing.BadSignature:
        return None
    return get_user_model().objects.filter(pk=user_id, is_active=True).first()


def _admin_access(request):
    user = _api_user(request)
    if user is None:
        return None, JsonResponse({'detail': 'Authentification requise.'}, status=401)
    if not (user.is_staff or user.is_superuser):
        return None, JsonResponse({'detail': 'Accès réservé à l’administration.'}, status=403)
    return user, None


def _question_data(question, user=None, include_detail=False):
    captures = []
    if question.capture_ecran:
        captures.append({
            'id': f'legacy-{question.id}',
            'image': question.capture_ecran.url,
            'miniature': question.capture_ecran.url,
        })
    captures.extend(
        {
            'id': capture.id,
            'image': capture.image.url,
            'miniature': capture.image.url,
        }
        for capture in question.captures.all()
    )

    data = {
        'id': question.id,
        'titre': question.titre,
        'description': question.contenu,
        'auteur': _user_data(question.auteur),
        'categorie': {
            'id': question.categorie_id,
            'nom': question.categorie.nom,
            'couleur': '#1766f0',
        },
        'tags': list(question.tags.values_list('nom', flat=True)),
        'date_creation': question.date_creation.isoformat(),
        'reponses': question.reponses.count(),
        'accords': getattr(question, 'nombre_accords', 0),
        'resolue': question.reponses.filter(acceptee=True).exists(),
        'favori': getattr(question, 'mon_favori', False),
        'difficulte': '',
        'vues': (
            question.nombre_vues
            if hasattr(question, 'nombre_vues')
            else question.vues.count()
        ),
        'captures': captures,
        'code_extrait': question.extrait_code or '',
        'langage': '',
        'date_modification': None,
    }
    return data


def _question_tags(noms):
    tags = []
    for nom in noms[:5]:
        nom = str(nom).strip().lower()
        if nom:
            tag, _ = Tag.objects.get_or_create(nom=nom[:50])
            tags.append(tag)
    return tags


def _reponse_data(reponse, user=None):
    personnes_accord = list(
        reponse.accords.select_related('utilisateur').values(
            'utilisateur__username',
            'utilisateur__first_name',
            'utilisateur__last_name',
        )
    )
    return {
        'id': reponse.id,
        'auteur': _user_data(reponse.auteur),
        'contenu': reponse.contenu,
        'date_creation': reponse.date_creation.isoformat(),
        'date_modification': None,
        'accords': len(personnes_accord),
        'personnes_accord': [
            {
                'username': personne['utilisateur__username'],
                'prenom': personne['utilisateur__first_name'],
                'nom': personne['utilisateur__last_name'],
            }
            for personne in personnes_accord
        ],
        'mon_accord': (
            reponse.accords.filter(utilisateur=user).exists()
            if user is not None else False
        ),
        'acceptee': reponse.acceptee,
    }


@csrf_exempt
def inscrire(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    donnees = _json_body(request)
    if donnees is None:
        return JsonResponse({'detail': 'Corps JSON invalide.'}, status=400)

    username = str(donnees.get('username', '')).strip()
    email = str(donnees.get('email', '')).strip()
    profil = str(donnees.get('profil', '')).strip()
    matricule_numero = str(donnees.get('matricule', '')).strip()
    password = donnees.get('password', '')
    erreurs = {}
    if len(username) < 3:
        erreurs['username'] = ['Le nom d’utilisateur doit contenir au moins 3 caractères.']
    if not email:
        erreurs['email'] = ['Une adresse email est obligatoire.']
    if profil != 'etudiant':
        erreurs['profil'] = ['La création de compte est réservée aux étudiants.']
    niveau = str(donnees.get('niveau', '')).strip()
    if not niveau:
        erreurs['niveau'] = ['Choisissez votre niveau.']
    elif niveau not in dict(ProfilUtilisateur.NIVEAUX):
        erreurs['niveau'] = ['Choisissez un niveau valide.']
    if not isinstance(password, str) or len(password) < 8:
        erreurs['password'] = ['Le mot de passe doit contenir au moins 8 caractères.']
    if profil == 'etudiant' and not matricule_numero:
        erreurs['matricule'] = ['Le matricule étudiant est obligatoire.']

    User = get_user_model()
    if username and User.objects.filter(username__iexact=username).exists():
        erreurs['username'] = ['Ce nom d’utilisateur est déjà utilisé.']
    if email and User.objects.filter(email__iexact=email).exists():
        erreurs['email'] = ['Cette adresse email est déjà utilisée.']
    if erreurs:
        return JsonResponse(erreurs, status=400)

    with transaction.atomic():
        matricule = None
        if profil == 'etudiant':
            matricule = MatriculeEtudiant.objects.select_for_update().filter(
                numero=matricule_numero,
                utilisateur__isnull=True,
            ).first()
            if matricule is None:
                return JsonResponse(
                    {'matricule': ['Ce matricule est invalide ou a déjà été utilisé.']},
                    status=400,
                )

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=str(donnees.get('prenom', '')).strip(),
            last_name=str(donnees.get('nom', '')).strip(),
        )
        ProfilUtilisateur.objects.create(
            utilisateur=user,
            profil=profil,
            niveau=niveau if profil == 'etudiant' else '',
        )
        if matricule is not None:
            matricule.utilisateur = user
            matricule.save(update_fields=['utilisateur'])

    return JsonResponse({
        'utilisateur': {
            **_user_data(user),
        },
    }, status=201)


@csrf_exempt
def connecter(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    donnees = _json_body(request)
    if donnees is None:
        return JsonResponse({'detail': 'Corps JSON invalide.'}, status=400)

    identifier = str(donnees.get('identifier', '')).strip()
    password = donnees.get('password', '')
    User = get_user_model()
    user = User.objects.filter(email__iexact=identifier).first() if '@' in identifier else None
    username = user.username if user else identifier
    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({'detail': 'Identifiant ou mot de passe incorrect.'}, status=400)

    token = signing.dumps(user.pk, salt=TOKEN_SALT)
    return JsonResponse({'token': token, 'utilisateur': _user_data(user)})


@csrf_exempt
def deconnecter(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    return JsonResponse({'detail': 'Déconnexion réussie.'})


@csrf_exempt
def compte_courant(request):
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)
    return JsonResponse(_user_data(user))


@csrf_exempt
def modifier_niveau_api(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)
    if user.is_staff or user.is_superuser:
        return JsonResponse(
            {'detail': 'Le niveau ne s’applique pas aux comptes administrateurs.'},
            status=403,
        )
    donnees = _json_body(request)
    if donnees is None:
        return JsonResponse({'detail': 'Corps JSON invalide.'}, status=400)
    niveau = str(donnees.get('niveau', '')).strip()
    if niveau not in dict(ProfilUtilisateur.NIVEAUX):
        return JsonResponse({'niveau': ['Choisissez un niveau valide.']}, status=400)

    profil, _ = ProfilUtilisateur.objects.get_or_create(
        utilisateur=user,
        defaults={'profil': 'etudiant'},
    )
    profil.niveau = niveau
    profil.save(update_fields=['niveau'])
    user.profil_utilisateur = profil
    return JsonResponse(_user_data(user))


@csrf_exempt
def modifier_grade_enseignant_api(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)
    profil = getattr(user, 'profil_utilisateur', None)
    if user.is_staff or user.is_superuser or profil is None or profil.profil != 'enseignant':
        return JsonResponse(
            {'detail': 'Cette modification est réservée aux enseignants.'},
            status=403,
        )
    donnees = _json_body(request)
    if donnees is None:
        return JsonResponse({'detail': 'Corps JSON invalide.'}, status=400)
    grade = str(donnees.get('grade', '')).strip()
    if grade not in dict(ProfilUtilisateur.GRADES_ENSEIGNANT):
        return JsonResponse({'grade': ['Choisissez un grade valide.']}, status=400)

    profil.grade = grade
    profil.save(update_fields=['grade'])
    return JsonResponse(_user_data(user))


@csrf_exempt
def modifier_nom_administrateur_api(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)
    if not (user.is_staff or user.is_superuser):
        return JsonResponse(
            {'detail': 'Cette modification est réservée à l’administrateur.'},
            status=403,
        )
    donnees = _json_body(request)
    if donnees is None:
        return JsonResponse({'detail': 'Corps JSON invalide.'}, status=400)
    prenom = str(donnees.get('prenom', '')).strip()
    nom = str(donnees.get('nom', '')).strip()
    erreurs = {}
    if not prenom:
        erreurs['prenom'] = ['Le prénom est obligatoire.']
    if not nom:
        erreurs['nom'] = ['Le nom est obligatoire.']
    if erreurs:
        return JsonResponse(erreurs, status=400)

    user.first_name = prenom
    user.last_name = nom
    user.save(update_fields=['first_name', 'last_name'])
    return JsonResponse(_user_data(user))


@csrf_exempt
def changer_mot_de_passe_api(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)
    donnees = _json_body(request)
    if donnees is None:
        return JsonResponse({'detail': 'Corps JSON invalide.'}, status=400)
    ancien = donnees.get('ancien', '')
    nouveau = donnees.get('nouveau', '')
    if not isinstance(ancien, str) or not isinstance(nouveau, str) or not ancien or not nouveau:
        return JsonResponse(
            {'detail': 'Saisissez votre mot de passe actuel et le nouveau mot de passe.'},
            status=400,
        )
    if not user.check_password(ancien):
        return JsonResponse({'ancien': ['Le mot de passe actuel est incorrect.']}, status=400)
    try:
        validate_password(nouveau, user)
    except ValidationError as erreur:
        return JsonResponse({'nouveau': erreur.messages}, status=400)

    user.set_password(nouveau)
    user.save(update_fields=['password'])
    return JsonResponse({
        'token': signing.dumps(user.pk, salt=TOKEN_SALT),
        'detail': 'Mot de passe modifié avec succès.',
    })


@csrf_exempt
def photo_profil_api(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)
    photo = request.FILES.get('photo')
    if photo is None:
        return JsonResponse({'photo': ['Choisissez une photo à envoyer.']}, status=400)
    if photo.size > 5 * 1024 * 1024:
        return JsonResponse(
            {'photo': ['La photo ne peut pas dépasser 5 Mo.']},
            status=400,
        )
    try:
        photo = forms.ImageField().clean(photo)
    except ValidationError as erreur:
        return JsonResponse({'photo': erreur.messages}, status=400)

    profil, _ = ProfilUtilisateur.objects.get_or_create(utilisateur=user)
    ancienne_photo = profil.photo
    profil.photo = photo
    profil.save(update_fields=['photo'])
    user.profil_utilisateur = profil
    if ancienne_photo and ancienne_photo.name != profil.photo.name:
        ancienne_photo.delete(save=False)
    return JsonResponse(_user_data(user))


BAREME_CLASSEMENT = {
    'question': 2,
    'reponse': 1,
    'acceptee': 5,
}


def _classement_membres():
    membres = []
    utilisateurs = get_user_model().objects.filter(is_active=True).annotate(
        nombre_questions=Count('questions', distinct=True),
        nombre_reponses=Count('reponses', distinct=True),
        nombre_acceptees=Count(
            'reponses',
            filter=Q(reponses__acceptee=True),
            distinct=True,
        ),
        nombre_votes_recus=Count('reponses__accords', distinct=True),
    ).order_by('username')
    for user in utilisateurs:
        questions = user.nombre_questions
        reponses = user.nombre_reponses
        acceptees = user.nombre_acceptees
        votes_recus = user.nombre_votes_recus
        points = (
            questions * BAREME_CLASSEMENT['question']
            + reponses * BAREME_CLASSEMENT['reponse']
            + acceptees * BAREME_CLASSEMENT['acceptee']
            + votes_recus
        )
        membres.append({
            'username': user.username,
            'prenom': user.first_name,
            'nom': user.last_name,
            'questions': questions,
            'reponses': reponses,
            'acceptees': acceptees,
            'votes_recus': votes_recus,
            'points': points,
        })
    return sorted(membres, key=lambda membre: (-membre['points'], membre['username'].lower()))


@csrf_exempt
def membre_api(request, username):
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])
    utilisateur_connecte = _api_user(request)

    user = get_user_model().objects.filter(
        username__iexact=username,
        is_active=True,
    ).first()
    if user is None:
        return JsonResponse({'detail': 'Ce membre n’existe pas.'}, status=404)

    questions = [
        {
            'id': question.id,
            'titre': question.titre,
            'categorie': {
                'nom': question.categorie.nom,
                'couleur': '#1766f0',
            },
            'date_creation': question.date_creation.isoformat(),
            'reponses': question.nombre_reponses,
            'resolue': question.est_resolue,
        }
        for question in Question.objects.filter(auteur=user).select_related('categorie').annotate(
            nombre_reponses=Count('reponses', distinct=True),
            est_resolue=Exists(
                Reponse.objects.filter(question_id=OuterRef('pk'), acceptee=True)
            ),
        )
    ]
    reponses = [
        {
            'id': reponse.id,
            'question': {
                'id': reponse.question_id,
                'titre': reponse.question.titre,
            },
            'extrait': reponse.contenu,
            'date_creation': reponse.date_creation.isoformat(),
            'accords': reponse.nombre_accords,
            'acceptee': reponse.acceptee,
        }
        for reponse in Reponse.objects.filter(auteur=user).select_related('question').annotate(
            nombre_accords=Count('accords', distinct=True),
        )
    ]
    classement = _classement_membres()
    membre_classe = next(
        (membre for membre in classement if membre['username'] == user.username),
        None,
    )
    stats = {
        'questions': len(questions),
        'reponses': len(reponses),
        'acceptees': sum(reponse['acceptee'] for reponse in reponses),
        'votes_recus': sum(reponse['accords'] for reponse in reponses),
        'rang': (
            classement.index(membre_classe) + 1
            if membre_classe and membre_classe['points'] > 0 else None
        ),
        'points': membre_classe['points'] if membre_classe else 0,
    }
    donnees_membre = _user_data(user)
    if utilisateur_connecte is None or user.pk != utilisateur_connecte.pk:
        donnees_membre.pop('email', None)
        donnees_membre.pop('matricule', None)
    return JsonResponse({
        **donnees_membre,
        'date_inscription': user.date_joined.isoformat(),
        'questions': questions,
        'reponses': reponses,
        'stats': stats,
    })


@require_GET
def classement_api(request):
    membres = _classement_membres()
    for rang, membre in enumerate(membres, start=1):
        membre['rang'] = rang
    return JsonResponse({
        'bareme': {**BAREME_CLASSEMENT, 'vote': 1},
        'membres': membres,
    })


@csrf_exempt
def questions_api(request):
    if request.method == 'GET':
        user = _api_user(request)
        questions = (
            Question.objects.select_related('auteur', 'categorie')
            .prefetch_related('tags')
        )
        if user is not None:
            questions_non_vues = questions.exclude(vues__utilisateur=user)
            vue.objects.bulk_create(
                [
                    vue(question_id=question_id, utilisateur=user)
                    for question_id in questions_non_vues.values_list('id', flat=True)
                ],
                ignore_conflicts=True,
            )
        questions = questions.annotate(
            nombre_vues=Count('vues__utilisateur', distinct=True),
            nombre_accords=Count('reponses__accords', distinct=True),
        )
        if user is not None:
            questions = questions.annotate(
                mon_favori=Exists(
                    FavoriQuestion.objects.filter(
                        question_id=OuterRef('pk'),
                        utilisateur=user,
                    )
                )
            )
        return JsonResponse([_question_data(question, user) for question in questions], safe=False)
    if request.method != 'POST':
        return HttpResponseNotAllowed(['GET', 'POST'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)
    donnees = _json_body(request)
    if donnees is None:
        return JsonResponse({'detail': 'Corps JSON invalide.'}, status=400)
    titre = str(donnees.get('titre', '')).strip()
    contenu = str(donnees.get('description', '')).strip()
    try:
        categorie_id = int(donnees.get('categorie_id'))
        categorie_question = categorie.objects.get(pk=categorie_id)
    except (TypeError, ValueError, categorie.DoesNotExist):
        return JsonResponse({'categorie_id': ['Choisissez une catégorie valide.']}, status=400)
    if not titre or not contenu:
        return JsonResponse({'detail': 'Le titre et la description sont obligatoires.'}, status=400)

    question = Question.objects.create(
        titre=titre,
        contenu=contenu,
        extrait_code=str(donnees.get('code_extrait', '')).strip(),
        auteur=user,
        categorie=categorie_question,
    )
    tags = donnees.get('tags', [])
    if isinstance(tags, list):
        question.tags.add(*_question_tags(tags))
    return JsonResponse(_question_data(question, user, include_detail=True), status=201)


@csrf_exempt
def question_api(request, question_id):
    user = _api_user(request)
    questions = (
        Question.objects.select_related('auteur', 'categorie')
        .prefetch_related('tags')
        .annotate(nombre_vues=Count('vues__utilisateur', distinct=True))
        .annotate(nombre_accords=Count('reponses__accords', distinct=True))
    )
    if user is not None:
        questions = questions.annotate(
            mon_favori=Exists(
                FavoriQuestion.objects.filter(
                    question_id=OuterRef('pk'),
                    utilisateur=user,
                )
            )
        )
    try:
        question = questions.get(pk=question_id)
    except Question.DoesNotExist:
        return JsonResponse({'detail': 'Question introuvable.'}, status=404)
    if request.method == 'GET':
        if user is not None:
            vue.objects.get_or_create(question=question, utilisateur=user)
        question.nombre_vues = vue.objects.filter(question=question).aggregate(
            nombre_vues=Count('utilisateur', distinct=True)
        )['nombre_vues']
        return JsonResponse(_question_data(question, user, include_detail=True))
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)
    if question.auteur_id != user.id:
        return JsonResponse({'detail': 'Seul l’auteur peut modifier cette question.'}, status=403)
    if request.method == 'DELETE':
        question.delete()
        return HttpResponse(status=204)
    if request.method != 'PATCH':
        return HttpResponseNotAllowed(['GET', 'PATCH', 'DELETE'])
    donnees = _json_body(request)
    if donnees is None:
        return JsonResponse({'detail': 'Corps JSON invalide.'}, status=400)
    if 'titre' in donnees:
        question.titre = str(donnees['titre']).strip()
    if 'description' in donnees:
        question.contenu = str(donnees['description']).strip()
    if 'code_extrait' in donnees:
        question.extrait_code = str(donnees['code_extrait']).strip()
    if 'categorie_id' in donnees:
        try:
            question.categorie = categorie.objects.get(pk=int(donnees['categorie_id']))
        except (TypeError, ValueError, categorie.DoesNotExist):
            return JsonResponse({'categorie_id': ['Choisissez une catégorie valide.']}, status=400)
    question.save()
    if isinstance(donnees.get('tags'), list):
        question.tags.set(_question_tags(donnees['tags']))
    return JsonResponse(_question_data(question, user, include_detail=True))


@csrf_exempt
def captures_question_api(request, question_id):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)
    try:
        question = Question.objects.get(pk=question_id)
    except Question.DoesNotExist:
        return JsonResponse({'detail': 'Question introuvable.'}, status=404)
    if question.auteur_id != user.id:
        return JsonResponse(
            {'detail': 'Seul l’auteur peut ajouter des captures à cette question.'},
            status=403,
        )

    fichiers = request.FILES.getlist('images')
    if not fichiers:
        return JsonResponse({'images': ['Choisissez au moins une image.']}, status=400)
    nombre_existant = question.captures.count() + bool(question.capture_ecran)
    if nombre_existant + len(fichiers) > 5:
        return JsonResponse(
            {'images': ['Une question peut contenir au maximum 5 images.']},
            status=400,
        )

    images = []
    for fichier in fichiers:
        if fichier.size > 5 * 1024 * 1024:
            return JsonResponse(
                {'images': ['Chaque image ne peut pas dépasser 5 Mo.']},
                status=400,
            )
        try:
            images.append(forms.ImageField().clean(fichier))
        except ValidationError as erreur:
            return JsonResponse({'images': erreur.messages}, status=400)

    with transaction.atomic():
        CaptureQuestion.objects.bulk_create(
            [CaptureQuestion(question=question, image=image) for image in images]
        )
    return JsonResponse(_question_data(question)['captures'], safe=False, status=201)


@csrf_exempt
def supprimer_capture_api(request, capture_id):
    if request.method != 'DELETE':
        return HttpResponseNotAllowed(['DELETE'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)

    if capture_id.startswith('legacy-'):
        try:
            question = Question.objects.get(pk=int(capture_id.removeprefix('legacy-')))
        except (ValueError, Question.DoesNotExist):
            return JsonResponse({'detail': 'Capture introuvable.'}, status=404)
        if question.auteur_id != user.id:
            return JsonResponse({'detail': 'Seul l’auteur peut supprimer cette capture.'}, status=403)
        if not question.capture_ecran:
            return JsonResponse({'detail': 'Capture introuvable.'}, status=404)
        question.capture_ecran.delete(save=True)
        return JsonResponse({'detail': 'Capture supprimée.'})

    try:
        capture = CaptureQuestion.objects.select_related('question').get(pk=int(capture_id))
    except (ValueError, CaptureQuestion.DoesNotExist):
        return JsonResponse({'detail': 'Capture introuvable.'}, status=404)
    if capture.question.auteur_id != user.id:
        return JsonResponse({'detail': 'Seul l’auteur peut supprimer cette capture.'}, status=403)
    capture.image.delete(save=False)
    capture.delete()
    return JsonResponse({'detail': 'Capture supprimée.'})


@csrf_exempt
def basculer_favori_api(request, question_id):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)

    with transaction.atomic():
        try:
            question = Question.objects.select_for_update().get(pk=question_id)
        except Question.DoesNotExist:
            return JsonResponse({'detail': 'Question introuvable.'}, status=404)

        favori = FavoriQuestion.objects.filter(
            question=question,
            utilisateur=user,
        )
        if favori.exists():
            favori.delete()
            est_favori = False
        else:
            FavoriQuestion.objects.create(question=question, utilisateur=user)
            est_favori = True

    return JsonResponse({'favori': est_favori})


@csrf_exempt
def reponses_api(request, question_id):
    try:
        question = Question.objects.get(pk=question_id)
    except Question.DoesNotExist:
        return JsonResponse({'detail': 'Question introuvable.'}, status=404)
    if request.method == 'GET':
        user = _api_user(request)
        reponses = question.reponses.select_related('auteur').all()
        return JsonResponse([_reponse_data(reponse, user) for reponse in reponses], safe=False)
    if request.method != 'POST':
        return HttpResponseNotAllowed(['GET', 'POST'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)
    if question.auteur_id == user.id:
        return JsonResponse(
            {'detail': 'Vous ne pouvez pas répondre à votre propre question.'},
            status=403,
        )
    donnees = _json_body(request)
    contenu = str((donnees or {}).get('contenu', '')).strip()
    if not contenu:
        return JsonResponse({'contenu': ['La réponse ne peut pas être vide.']}, status=400)
    reponse = Reponse.objects.create(question=question, auteur=user, contenu=contenu)
    if question.auteur_id != user.id:
        notification.objects.create(
            destinateur=question.auteur,
            acteur=user,
            question=question,
            reponse=reponse,
            type='reponse',
            message=f'{user.username} a répondu à votre question « {question.titre} »',
        )
    return JsonResponse(_reponse_data(reponse, user), status=201)


@csrf_exempt
def voter_reponse_api(request, reponse_id):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)
    try:
        reponse = Reponse.objects.select_related('auteur', 'question').get(pk=reponse_id)
    except Reponse.DoesNotExist:
        return JsonResponse({'detail': 'Réponse introuvable.'}, status=404)
    if reponse.auteur_id == user.id:
        return JsonResponse(
            {'detail': 'Vous ne pouvez pas marquer votre propre réponse comme identique.'},
            status=403,
        )
    if reponse.question.auteur_id == user.id:
        return JsonResponse(
            {'detail': 'Vous ne pouvez pas voter pour une réponse à votre propre question.'},
            status=403,
        )

    with transaction.atomic():
        accord, cree = AccordReponse.objects.get_or_create(
            reponse=reponse,
            utilisateur=user,
        )
        if not cree:
            accord.delete()
        else:
            notification.objects.create(
                destinateur=reponse.auteur,
                acteur=user,
                question=reponse.question,
                reponse=reponse,
                type='accord_reponse',
                message=f'{user.username} a voté votre réponse à « {reponse.question.titre} »',
            )

    return JsonResponse(_reponse_data(reponse, user))


@csrf_exempt
def accepter_reponse_api(request, reponse_id):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)

    with transaction.atomic():
        try:
            reponse = Reponse.objects.select_related('question').get(pk=reponse_id)
        except Reponse.DoesNotExist:
            return JsonResponse({'detail': 'Réponse introuvable.'}, status=404)
        if reponse.question.auteur_id != user.id:
            return JsonResponse(
                {'detail': 'Seul l’auteur de la question peut accepter une réponse.'},
                status=403,
            )

        if reponse.acceptee:
            reponse.acceptee = False
        else:
            Reponse.objects.filter(
                question_id=reponse.question_id,
                acceptee=True,
            ).exclude(pk=reponse.pk).update(acceptee=False)
            reponse.acceptee = True
        reponse.save(update_fields=['acceptee'])

    return JsonResponse(_reponse_data(reponse))


@csrf_exempt
def notifications_api(request):
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)

    notifications = notification.objects.filter(destinateur=user).select_related(
        'acteur', 'question', 'reponse',
    )[:50]
    return JsonResponse({
        'non_lues': notification.objects.filter(destinateur=user, lue=False).count(),
        'notifications': [
            {
                'id': item.id,
                'type': item.type,
                'lue': item.lue,
                'date': item.date_creation.isoformat(),
                'acteur': _user_data(item.acteur) if item.acteur else {
                    'username': 'INSTA-FORUM',
                    'prenom': '',
                    'nom': '',
                },
                'question': {
                    'id': item.question_id,
                    'titre': item.question.titre if item.question else item.message,
                },
                'reponse': {'id': item.reponse_id} if item.reponse_id else None,
            }
            for item in notifications
        ],
    })


@csrf_exempt
def marquer_notifications_lues_api(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    user = _api_user(request)
    if user is None:
        return JsonResponse({'detail': 'Authentification requise.'}, status=401)
    donnees = _json_body(request)
    if donnees is None:
        return JsonResponse({'detail': 'Corps JSON invalide.'}, status=400)

    notifications = notification.objects.filter(destinateur=user, lue=False)
    if donnees.get('id') is not None:
        try:
            notification_id = int(donnees['id'])
        except (TypeError, ValueError):
            return JsonResponse({'id': ['Identifiant de notification invalide.']}, status=400)
        notifications = notifications.filter(pk=notification_id)
    notifications.update(lue=True)
    return JsonResponse({
        'non_lues': notification.objects.filter(destinateur=user, lue=False).count(),
    })


@require_GET
def categories_api(request):
    donnees = categorie.objects.annotate(nombre=Count('questions')).order_by('nom')
    return JsonResponse([
        {'id': item.id, 'nom': item.nom, 'couleur': '#1766f0', 'nb_questions': item.nombre}
        for item in donnees
    ], safe=False)


@csrf_exempt
def admin_forum_api(request):
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])
    _, erreur = _admin_access(request)
    if erreur:
        return erreur

    User = get_user_model()
    return JsonResponse({
        'utilisateurs': [
            {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'prenom': user.first_name,
                'nom': user.last_name,
                'actif': user.is_active,
                'is_staff': user.is_staff or user.is_superuser,
                'profil': (
                    'administrateur' if user.is_staff or user.is_superuser
                    else user.profil_utilisateur.profil if hasattr(user, 'profil_utilisateur')
                    else 'etudiant'
                ),
                'date_creation': user.date_joined.isoformat(),
            }
            for user in User.objects.select_related('profil_utilisateur').order_by('username')
        ],
        'questions': [
            {
                'id': question.id,
                'titre': question.titre,
                'auteur': question.auteur.username,
                'categorie': question.categorie.nom,
                'reponses': question.reponses.count(),
                'date_creation': question.date_creation.isoformat(),
            }
            for question in Question.objects.select_related(
                'auteur', 'categorie',
            )
        ],
        'reponses': [
            {
                'id': reponse.id,
                'contenu': reponse.contenu,
                'auteur': reponse.auteur.username,
                'question': reponse.question.titre,
                'acceptee': reponse.acceptee,
                'date_creation': reponse.date_creation.isoformat(),
            }
            for reponse in Reponse.objects.select_related(
                'auteur', 'question',
            )
        ],
        'categories': [
            {'id': item.id, 'nom': item.nom, 'questions': item.nombre}
            for item in categorie.objects.annotate(
                nombre=Count('questions'),
            ).order_by('nom')
        ],
        'matricules': [
            {
                'id': item.id,
                'numero': item.numero,
                'utilisateur': item.utilisateur.username if item.utilisateur else None,
            }
            for item in MatriculeEtudiant.objects.select_related(
                'utilisateur',
            ).order_by('numero')
        ],
    })


@csrf_exempt
def admin_utilisateur_api(request, utilisateur_id):
    if request.method != 'DELETE':
        return HttpResponseNotAllowed(['DELETE'])
    administrateur, erreur = _admin_access(request)
    if erreur:
        return erreur
    try:
        utilisateur = get_user_model().objects.get(pk=utilisateur_id)
    except get_user_model().DoesNotExist:
        return JsonResponse({'detail': 'Utilisateur introuvable.'}, status=404)
    if utilisateur.pk == administrateur.pk:
        return JsonResponse({'detail': 'Vous ne pouvez pas supprimer votre propre compte.'}, status=403)
    if utilisateur.is_staff or utilisateur.is_superuser:
        return JsonResponse(
            {'detail': 'Les comptes administrateurs se gèrent depuis Django Admin.'},
            status=403,
        )
    utilisateur.delete()
    return HttpResponse(status=204)


@csrf_exempt
def admin_question_api(request, question_id):
    if request.method != 'DELETE':
        return HttpResponseNotAllowed(['DELETE'])
    _, erreur = _admin_access(request)
    if erreur:
        return erreur
    try:
        question = Question.objects.get(pk=question_id)
    except Question.DoesNotExist:
        return JsonResponse({'detail': 'Question introuvable.'}, status=404)
    question.delete()
    return HttpResponse(status=204)


@csrf_exempt
def admin_reponse_api(request, reponse_id):
    if request.method != 'DELETE':
        return HttpResponseNotAllowed(['DELETE'])
    _, erreur = _admin_access(request)
    if erreur:
        return erreur
    try:
        reponse = Reponse.objects.get(pk=reponse_id)
    except Reponse.DoesNotExist:
        return JsonResponse({'detail': 'Réponse introuvable.'}, status=404)
    reponse.delete()
    return HttpResponse(status=204)


@csrf_exempt
def admin_categorie_api(request, categorie_id=None):
    if request.method not in ('POST', 'PATCH', 'DELETE'):
        return HttpResponseNotAllowed(['POST', 'PATCH', 'DELETE'])
    _, erreur = _admin_access(request)
    if erreur:
        return erreur
    if request.method == 'POST' and categorie_id is not None:
        return HttpResponseNotAllowed(['PATCH', 'DELETE'])
    if request.method != 'POST' and categorie_id is None:
        return HttpResponseNotAllowed(['POST'])

    if request.method == 'POST':
        item = None
    else:
        try:
            item = categorie.objects.get(pk=categorie_id)
        except categorie.DoesNotExist:
            return JsonResponse({'detail': 'Catégorie introuvable.'}, status=404)

    if request.method == 'DELETE':
        if item.questions.exists():
            return JsonResponse(
                {'detail': 'Impossible de supprimer une catégorie qui contient des questions.'},
                status=409,
            )
        item.delete()
        return HttpResponse(status=204)

    donnees = _json_body(request)
    if donnees is None:
        return JsonResponse({'detail': 'Corps JSON invalide.'}, status=400)
    nom = str(donnees.get('nom', '')).strip()
    if not nom or len(nom) > 100:
        return JsonResponse({'nom': ['Saisissez un nom de 1 à 100 caractères.']}, status=400)
    doublon = categorie.objects.filter(nom__iexact=nom)
    if item is not None:
        doublon = doublon.exclude(pk=item.pk)
    if doublon.exists():
        return JsonResponse({'nom': ['Cette catégorie existe déjà.']}, status=400)
    if item is None:
        item = categorie.objects.create(nom=nom)
        return JsonResponse({'id': item.id, 'nom': item.nom, 'questions': 0}, status=201)
    item.nom = nom
    item.save(update_fields=['nom'])
    return JsonResponse({
        'id': item.id,
        'nom': item.nom,
        'questions': item.questions.count(),
    })


@csrf_exempt
def admin_matricule_api(request, matricule_id=None):
    if request.method not in ('POST', 'PATCH', 'DELETE'):
        return HttpResponseNotAllowed(['POST', 'PATCH', 'DELETE'])
    _, erreur = _admin_access(request)
    if erreur:
        return erreur
    if request.method == 'POST' and matricule_id is not None:
        return HttpResponseNotAllowed(['PATCH', 'DELETE'])
    if request.method != 'POST' and matricule_id is None:
        return HttpResponseNotAllowed(['POST'])

    if request.method == 'POST':
        item = None
    else:
        try:
            item = MatriculeEtudiant.objects.get(pk=matricule_id)
        except MatriculeEtudiant.DoesNotExist:
            return JsonResponse({'detail': 'Matricule introuvable.'}, status=404)

    if item is not None and item.utilisateur_id is not None:
        return JsonResponse(
            {'detail': 'Un matricule déjà attribué à un compte ne peut pas être modifié ou supprimé.'},
            status=409,
        )
    if request.method == 'DELETE':
        item.delete()
        return HttpResponse(status=204)

    donnees = _json_body(request)
    if donnees is None:
        return JsonResponse({'detail': 'Corps JSON invalide.'}, status=400)
    numero = str(donnees.get('numero', '')).strip()
    if not numero or len(numero) > 50:
        return JsonResponse({'numero': ['Saisissez un matricule de 1 à 50 caractères.']}, status=400)
    doublon = MatriculeEtudiant.objects.filter(numero__iexact=numero)
    if item is not None:
        doublon = doublon.exclude(pk=item.pk)
    if doublon.exists():
        return JsonResponse({'numero': ['Ce matricule existe déjà.']}, status=400)
    if item is None:
        item = MatriculeEtudiant.objects.create(numero=numero)
        return JsonResponse({
            'id': item.id,
            'numero': item.numero,
            'utilisateur': None,
        }, status=201)
    item.numero = numero
    item.save(update_fields=['numero'])
    return JsonResponse({
        'id': item.id,
        'numero': item.numero,
        'utilisateur': None,
    })


@csrf_exempt
def admin_enseignant_api(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    _, erreur = _admin_access(request)
    if erreur:
        return erreur
    donnees = _json_body(request)
    if donnees is None:
        return JsonResponse({'detail': 'Corps JSON invalide.'}, status=400)

    prenom = str(donnees.get('prenom', '')).strip()
    nom = str(donnees.get('nom', '')).strip()
    email = str(donnees.get('email', '')).strip()
    password = donnees.get('password', '')
    erreurs = {}
    if not prenom or len(prenom) > 150:
        erreurs['prenom'] = ['Saisissez un prénom de 1 à 150 caractères.']
    if not nom or len(nom) > 150:
        erreurs['nom'] = ['Saisissez un nom de 1 à 150 caractères.']
    if not email or len(email) > 254:
        erreurs['email'] = ['Saisissez une adresse e-mail valide.']
    else:
        try:
            EmailValidator()(email)
        except ValidationError:
            erreurs['email'] = ['Saisissez une adresse e-mail valide.']
        if get_user_model().objects.filter(email__iexact=email).exists():
            erreurs['email'] = ['Cette adresse e-mail est déjà utilisée.']
    if not isinstance(password, str) or not password:
        erreurs['password'] = ['Saisissez un mot de passe.']
    if erreurs:
        return JsonResponse(erreurs, status=400)

    User = get_user_model()
    base_username = f"enseignant-{slugify(email.partition('@')[0]) or 'compte'}"[:140]
    username = base_username
    suffixe = 1
    while User.objects.filter(username__iexact=username).exists():
        username = f"{base_username[:145 - len(str(suffixe))]}-{suffixe}"
        suffixe += 1

    utilisateur = User(
        username=username,
        email=email,
        first_name=prenom,
        last_name=nom,
    )
    try:
        validate_password(password, user=utilisateur)
    except ValidationError as validation:
        return JsonResponse({'password': validation.messages}, status=400)

    with transaction.atomic():
        utilisateur.set_password(password)
        utilisateur.save()
        ProfilUtilisateur.objects.create(
            utilisateur=utilisateur,
            profil='enseignant',
        )
    return JsonResponse({
        'id': utilisateur.id,
        'username': utilisateur.username,
        'email': utilisateur.email,
        'prenom': utilisateur.first_name,
        'nom': utilisateur.last_name,
        'profil': 'enseignant',
    }, status=201)


@require_GET
def statistiques_api(request):
    User = get_user_model()
    return JsonResponse({
        'questions': Question.objects.count(),
        'reponses': Reponse.objects.count(),
        'membres': User.objects.filter(is_active=True).count(),
        'contributeurs': [],
    })